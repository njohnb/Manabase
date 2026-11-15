# PRD — Magic: The Gathering rules and rulings

**Drafted 2026-11-15** from a brainstorming and grilling session with the author. This is a
**plan, not a binding document.** It proposes two capabilities and one component. Nothing here
is a `CAP` or `PC` until the blocks are appended to
[MCP-PRD §5](../MCP-PRD.md#5-capabilities) and [PLUGIN-PRD §5](../PLUGIN-PRD.md#5-components)
under their templates, with §6, §7 and §9 updated in the same session. Working names used
throughout: **CAP-03** (card rulings), **CAP-04** (Comprehensive Rules lookup), **PC-05** (the
rules skill). They become real IDs only when appended. Where this plan and a PRD disagree, the PRD
wins.

## Problem Statement

A Manabase user asks a rules question, such as "how does ward work", "does Rest in Peace stop my
Blood Artist triggers", or "can I respond to a cascade trigger". Today Claude answers from memory.
That is the worst place in the domain to answer from memory. The Comprehensive Rules (CR) change
roughly quarterly, wording gets reworked, and a confident wrong answer is indistinguishable from a
right one. The same gap weakens the other skills. When the combo skill or the deck skill suggests
an addition, cut or interaction, nothing in the plugin can check that the cards actually work
together the way the answer claims.

The project already knew this would be needed. "Comprehensive Rules lookup" has sat in
[MCP-PRD §6](../MCP-PRD.md#6-phases)'s queue since 2026-07-29.
[D-08](../MCP-PRD.md#d-08--comprehensive-rules-fetched-at-runtime-never-bundled) already decides
the source and the distribution constraint. [§4.6](../MCP-PRD.md#46-comprehensive-rules-wizards-of-the-coast)
already records how the TXT parses. Nothing has been specified or built.

## Solution

Claude gets two ways to look up rules, and one discipline for using them.

1. **Card rulings (CAP-03, ships first).** A `card_rulings` tool takes a small batch of card names
   and returns each card's official rulings, with dates and source labels. This mostly serves
   interaction questions. Scryfall attaches each ruling to **one** card, so there is no
   "interaction ruling" to look up. An interaction is answered by reading the rulings for every
   card involved, together, alongside the CR.
2. **Comprehensive Rules lookup (CAP-04, ships second).** A `rules_lookup` tool returns a rule and
   its subrules by number, or searches the glossary and then the full text by keyword. This mostly
   serves questions about a single card, mechanic or keyword. The CR is downloaded from Wizards on
   first use, cached locally, and checked for a newer version at most weekly.
3. **The rules skill (PC-05).** A new skill teaches Claude to look up, then cite. Every rules claim
   carries a rule number or a ruling date from a tool result. Nothing is asserted from memory, and
   if the tools are missing Claude says so instead of guessing. The combo and deck skills route
   "does this actually work?" questions to it.

Both tools can be used for card questions. The split is about what each is best at, not a hard
boundary.

## User Stories

**Rules questions**

1. As a player, I want to ask how a keyword works and get the CR's actual text with its rule
   number, so that I can trust the answer and show it to my playgroup.
2. As a player, I want to look up a rule by number, such as "702.19", and get every subrule under
   it, so that I see the whole rule and not one fragment.
3. As a player, I want to ask about a game term like "mana value" or "dies" and get the glossary
   definition first, so that the simplest correct answer comes first.
4. As a player, I want every rules answer to say which CR version it used, so that I know whether
   a recent rules update might change it.
5. As a player, I want a citation link to the official Wizards rules document, so that I can read
   the source myself.
6. As a player, I want Claude to tell me when it could not reach the rules tools, rather than
   answering from memory, so that a missing tool never quietly turns into a guessed answer.
7. As a player, I want a broad search like "damage" to return a bounded, useful set of matches, so
   that the answer is not buried under hundreds of rules.

**Card interactions**

8. As a player, I want to ask how two or three specific cards interact and have Claude read every
   card's official rulings together, so that the answer reflects how the cards actually behave.
9. As a player, I want each ruling labelled as an official Wizards ruling or a Scryfall note, so
   that I know how much weight to give it.
10. As a player, I want each ruling to carry its date, so that I can tell whether a later rules
    change may have overtaken it.
11. As a player, I want a link to each card's Scryfall page, so that I can read the full ruling
    list in context.
12. As a player, I want a misspelled card name reported back to me rather than silently dropped,
    so that a typo never produces an answer about fewer cards than I asked about.
13. As a player, I want Claude to combine card rulings with the relevant CR rules when answering
    an interaction question, so that the explanation covers both the card-specific ruling and the
    general rule behind it.

**Use from the other skills**

14. As a deckbuilder, I want the deck skill to confirm a suggested addition actually does what it
    claims in my deck, so that I don't add a card on a misread interaction.
15. As a combo player, I want to ask "does this combo really work?" about a combo I came up with
    myself and get a rules-cited answer, so that I can trust a combo that Commander Spellbook
    doesn't list.
16. As a combo player, I want Commander Spellbook's own results left as they are without an extra
    rules check every time, so that combo searches stay fast and inexpensive.
17. As a deckbuilder, I want a "can my commander do X" question answered from the CR's commander
    rules, so that format-specific questions are covered without a separate Commander source.

**Freshness and reliability**

18. As a user, I want the rules downloaded only when I first ask a rules question, so that the
    plugin costs nothing in sessions where I never ask one.
19. As a user, I want the cached rules refreshed automatically when Wizards publishes a new version,
    so that I never have to update anything by hand.
20. As a user, I want rules lookup to keep working from the cached copy when Wizards' site is down
    or has changed, and to be told how old that copy is, so that an outage costs me freshness and
    not the whole feature.
21. As a user offline after the first download, I want rules lookups to still work, so that I can
    use the feature at a game table with poor signal.
22. As a user, I want the first rules question to finish in a reasonable time even though it
    downloads the rules, so that first use doesn't feel broken.

**Maintainer**

23. As the maintainer, I want every parsing and version-selection rule tested against fixtures, so
    that a Wizards formatting change fails a test rather than producing silent wrong answers.
24. As the maintainer, I want the newest CR chosen by its date stamp and not by link order, so that
    a landing page listing two versions never serves the older one.
25. As the maintainer, I want an eval set of rules questions run with and without the skill, so
    that the skill's contribution is measured rather than assumed.
26. As the maintainer, I want the new tools to follow the existing failure contract, so that a
    rules failure reaches the model as a structured, retryable result like every other tool's.

## Implementation Decisions

### Decided in session

- **Scope is the CR and per-card rulings only.** Tournament documents (MTR, IPG) and a separate
  Commander rules source are out. Commander rules live in CR section 903, and ban lists already
  come from `card_search` legality.
- **Two capabilities, separately shippable, rulings first.** Card rulings are stateless and reuse
  existing batch resolution. CR lookup is the project's first stateful capability and carries the
  download, parser and cache.
- **No rules claim without a tool citation.** This extends
  [PLUGIN-PRD §3.6](../PLUGIN-PRD.md#36-skills-carry-instructions-never-facts) ("skills carry
  instructions, never facts") to rules, and repeats the no-fallback lesson of the Chat-tab bug: a
  missing tool is reported, never routed around.
- **Citations.** A CR citation is the rule number plus a link to the **official dated PDF** that
  Wizards hosts beside the TXT, with no page anchor. A ruling citation is its date, its source
  label and the card's Scryfall page.
- **Every `rules_lookup` response carries the CR effective date and the cached copy's age**, and
  the skill states which version it cited.
- **Each ruling keeps its `source` label** (`wotc` or `scryfall`), and the skill must say which
  one it is quoting.
- **Refresh.** The CR is downloaded on the first `rules_lookup` call and never at startup.
  [PQ-03](../PLUGIN-PRD.md#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook)
  already forbids a `SessionStart` hook. The landing page is revalidated at most once every seven
  days. On any failure the cached copy is served with its date and age reported. This answers the
  refresh-trigger half of
  [OQ-03](../MCP-PRD.md#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced),
  and its "does first run block" half as **yes, the first call blocks on one ~1 MB download**.
  That OQ entry still names tag discovery as its resolver, so the CAP-04 session must update it.
- **Acceptance includes an eval set** built like the
  [OQ-14 combo eval](../slices/OQ14-combo-eval-results.md): known-answer rules questions run in
  fresh subagents with and without the skill, against a clean-room baseline agent.

### Deep modules

Each one is callable as a plain function with its I/O injected, per
[D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions). Every handler
returns a structured failure rather than throwing, per
[D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw).

1. **Card rulings handler (CAP-03).** Interface: card names in, up to a cap of about 10 (the
   builder sets the exact number), and out comes `{ cards: [{ name, scryfall_uri, rulings: [{
   source, published_at, comment }] }], unresolved_cards }`. It resolves names through the
   existing `POST /cards/collection` batch resolver
   ([§4.1.2](../MCP-PRD.md#412-batch-resolution)), so misses come back as unresolved names. It then
   issues one `GET /cards/{id}/rulings` per resolved card. That path is not a card-search endpoint,
   so it falls on Scryfall's 10/sec lane under
   [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance). It needs Scryfall only,
   not both sources.
2. **CR source resolver (pure).** Interface: landing-page HTML in, `{ txtUrl, pdfUrl?,
   dateStamp }` or a failure out. It takes the newest `.txt` **by its date stamp, never the first
   match**, per [OQ-08](../MCP-PRD.md#oq-08--does-the-cr-landing-page-ever-offer-more-than-one-date-stamped-txt-and-how-are-mid-cycle-corrections-handled).
   It pairs the PDF carrying the same stamp, encodes the literal space in the filename, and falls
   back to citing the TXT when no matching PDF is listed.
3. **CR parser (pure).** Interface: raw TXT in, an index out: `{ effectiveDate, rules: number →
   { text, children }, glossary: term → definition }`. It handles everything
   [§4.6](../MCP-PRD.md#46-comprehensive-rules-wizards-of-the-coast) records: UTF-8 BOM, CRLF,
   the contents section that duplicates rule headings, subrule letters that **skip `l` and `o`**,
   and the glossary's term, definition and blank-line pattern.
4. **CR store.** Interface: `ensureRules(deps)` returns `{ index, effectiveDate, fetchedAt,
   checkedAt, stale }` or a failure. Its dependencies are an HTTP client, a filesystem, a clock and
   the cache directory. It owns the seven-day revalidation, the cache-on-failure fallback, and the
   decision to re-download only when the date stamp has changed. It writes under the existing
   resolved `cacheDir`, so the location half of OQ-03, already shipped, is reused rather than
   re-decided.
5. **Rules query (pure).** Interface: `lookupRule(index, number)` and `searchRules(index, query)`.
   Search returns glossary hits first, then full-text rule matches with their numbers, filled to a
   byte budget in the pattern of the combo tools' shared page budget. The budget figure is the
   builder's call.
6. **Rules lookup handler (CAP-04).** Interface: `{ rule } | { query }` in. Out comes the matched
   rules or glossary entries, `cr_effective_date`, `cache_age`, `stale` and the citation URL. It
   composes modules 3 to 5.
7. **The rules skill (PC-05).** Working name `mtg-rules`. It holds instructions only: when to call
   each tool, how to combine rulings with CR text for interactions, the citation format, how to
   label a ruling's source and the CR version, and the no-fallback rule. It names no scoped tool
   strings, per [P-12](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key). The two existing combo
   and deck skills gain a pointer to it for "does this work?" questions.

### Constraints the builder inherits

- **A new external source.** Wizards (`magic.wizards.com` and `media.wizards.com`) needs its own
  source spec on the shared HTTP client: the app-naming `User-Agent`, an `Accept` header and a
  conservative lane. The landing page and the download live on **two different hosts**, while a
  source spec carries one base URL. How to handle that is the builder's call. If Wizards blocks
  the request, that is an answer and not an obstacle
  ([§3.7](../MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis)): serve the cache and
  report the block.
- **Never bundle the CR text** ([D-08](../MCP-PRD.md#d-08--comprehensive-rules-fetched-at-runtime-never-bundled)).
  Test fixtures must be short synthetic excerpts in the CR's format, never a committed copy of the
  document.
- **Five registered tools** means the MCPB manifest must declare `card_rulings` and
  `rules_lookup`. The manifest drift test fails otherwise, and `dist/` is rebuilt with the change.
- **Skill frontmatter quoting and no links outside the skill directory**, as for every skill in
  this repo.

### Needs a decision before CAP-03 is appended

- **[D-07](../MCP-PRD.md#d-07--three-way-cache-split) lists `rulings` among the bulk-file
  corpora.** This plan reads D-07 as governing *corpora that would otherwise cost thousands of
  requests*. A capped lookup of about 10 cards per call is not one, so the live per-card endpoint
  is used and CAP-03 stays stateless. If D-07 is instead read as "rulings always come from bulk",
  CAP-03 becomes stateful and loses its reason to ship first. §2 is locked, so this is the
  author's reading to confirm in the CAP-03 session, not a builder's call. Recommended: confirm the
  corpora reading and record it as a sentence in CAP-03, not as an amendment to D-07.
- **The rulings response shape is unverified.** `source`, `published_at` and `comment` are
  recalled, not measured. CAP-03's session should verify the response shape with one spaced live
  probe and append it to §4.1 as a dated, verified record.

## Testing Decisions

- **A good test calls the public function with fakes and asserts on the returned shape.**
  `node:test` with `node:assert/strict`, fixtures loaded with `readFileSync`, and handlers called
  as plain functions. No test touches the network. Live behavior belongs to the acceptance script
  and the eval run.
- **Modules tested:** all six code modules.
  - Parser tests use synthetic excerpts covering the BOM, CRLF, an `l`/`o` letter skip, the
    duplicated contents section and a multi-line glossary entry.
  - Resolver tests include a landing page listing **two** date stamps out of order, a missing
    PDF, and a page with no `.txt` at all.
  - Store tests drive a fake clock across the seven-day boundary. They cover an unchanged stamp
    (no re-download), a changed stamp, a failed revalidation (cache served with `stale`), and a
    first run with no cache that fails (structured failure).
  - Query tests cover the glossary-first ordering and the byte budget on a broad term.
  - Handler tests cover an unknown rule number and unresolved names.
- **Prior art.** The handler-level tests of the existing tools are the model: the tests for the
  three current tool handlers, the name-batching tests for collection resolution, the shared
  page-budget tests, and the manifest drift test. The live acceptance script gains spaced checks
  for both tools and never provokes a 429.
- **Skill-level acceptance** comes from the eval set. Criteria: correct rule or ruling citation,
  zero uncited rules claims, the CR version stated, and the ruling source labelled. Each is run
  with and without the skill, as in OQ-14. The skill must be confirmed **loaded** in the session
  listing before its numbers are recorded, because a skill that never loaded can pass static
  checks.

## Out of Scope

- Tournament documents (MTR, IPG) and judge-level procedure.
- A separate Commander rules source.
- **PDF page or highlight deep links.** Wizards' PDF has no per-rule anchors, and getting a page
  number means downloading and parsing the PDF with a large bundled dependency. The `#search=`
  highlight works in only some viewers.
- **A local HTML CR viewer** with per-rule anchors and highlighting. The author chose this as the
  follow-up, sharing [PC-04](../PLUGIN-PRD.md#pc-04--card-viewer)'s local server once that exists.
  It is to be captured in [IDEAS.md](../../IDEAS.md), not specified here.
- Automatic rules checks on Commander Spellbook results.
- Third-party hyperlinked CR mirrors, which risk citing one version while linking another.
- Rulings inside `card_search` results (88 extra requests per page).
- Tag discovery and the bulk-data half of OQ-03.
- Phase and slice assignment, which belong to the session that schedules the work.

## Further Notes

- **Landing order.** Append CAP-03 to MCP-PRD and PC-05 to PLUGIN-PRD once the D-07 reading is
  confirmed. CAP-04 follows, and its session settles the refresh half of OQ-03 with a dated §7
  answer and a §9 row.
- **OQ-08 stays open.** Writing the resolver to take the newest stamp is how this plan complies
  with its open half, not an answer to it.
- **The Fan Content disclaimer** still covers every user-facing surface, and the skill's
  description must not grow past the measured context budget without being re-measured.
- **The deep-module list above is a proposal** for the author to confirm, including which modules
  get tests beyond the default of all six.
