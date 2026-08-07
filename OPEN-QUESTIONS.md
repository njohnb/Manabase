# Open questions — Q/A

All 21 numbered questions the project carries, in question-and-answer form: 12 `OQ-` in
[`docs/MCP-PRD.md` §7](./docs/MCP-PRD.md#7-open-questions) and 9 `PQ-` in
[`docs/PLUGIN-PRD.md` §7](./docs/PLUGIN-PRD.md#7-open-questions).

**This file is derived and binds nothing.** The owning PRD entry is authoritative for every
question below; each answer here links to it. If the two disagree, the PRD is right and this file
is stale — fix it here, never there. It exists because the two `§7` sections are long-form and
cross-linked for a reader who is already deep in one document, and there was no single place to
see all 21 at once with a verdict on which are settleable today.

Triaged **2026-08-07**. The "settle now?" verdict answers one specific question — *can this be
resolved on a machine that cannot install or run the plugin?* — so it distinguishes desk work from
work that needs a live harness, a live third party, or a capability that does not exist yet.

| ID | Question, short | Status | Settle now? |
|---|---|---|---|
| [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) | How is Scryfall syntax surfaced to the model? | Answered 2026-08-04 | Done |
| [OQ-02](#oq-02--how-verbose-should-a-search-result-be) | How verbose should a search result be? | Partly answered | **Yes — desk** |
| [OQ-03](#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced) | Bulk-data storage strategy, and when? | Partly answered | **Partly — desk** |
| [OQ-04](#oq-04--what-is-the-behavior-and-blast-radius-of-archidekts-write-api) | Archidekt write API behavior and blast radius? | Open | No — deferred by design |
| [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) | Do Spellbook / Archidekt / Moxfield rate-limit? | Open | No — third party must reply |
| [OQ-06](#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code) | Is Spellbook's combo *data* licensed? | Open | No — third party must reply |
| [OQ-07](#oq-07--how-is-intentionallyskippedcarddata-populated-in-archidekt-deck-payloads-and-what-does-its-presence-mean-for-a-deck-read) | What populates `intentionallySkippedCardData`? | Open | **Yes — a few HTTP calls** |
| [OQ-08](#oq-08--does-the-cr-landing-page-ever-offer-more-than-one-date-stamped-txt-and-how-are-mid-cycle-corrections-handled) | Can the CR page list more than one TXT? | Open | **Half — one HTTP call** |
| [OQ-09](#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists) | EUR fallback when no USD price exists? | Open | **Yes — two HTTP calls** |
| [OQ-10](#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms) | Will Moxfield grant approved access? | Open | No — third party must reply |
| [OQ-11](#oq-11--does-moxfield-mask-private-and-unlisted-decks-behind-the-same-404-as-an-unknown-id) | Does Moxfield mask private decks as 404? | Open | **Yes — three HTTP calls** |
| [OQ-12](#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two) | Normalized deck shape; one tool or two? | Open | **Yes — desk** |
| [PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) | Do tool schemas count as always-on cost? | Open | No — needs an installed harness |
| [PQ-02](#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) | What is this plugin's always-on cost? | Open | No — needs an installed harness |
| [PQ-03](#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook) | Cache refresh trigger; ever a `SessionStart` hook? | Open | **Half — desk** |
| [PQ-04](#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) | How to detect a friend's trimmed skill listing? | Open | **Mostly — desk** |
| [PQ-05](#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable) | Submit to the community marketplace? | Open | No — post-Phase-1 by its own terms |
| [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) | What keeps the committed `dist/` honest? | Half-answered | **Yes — desk + one push** |
| [PQ-07](#pq-07--is-deck-optimization-a-skill-or-an-agent) | Is deck optimization a skill or an agent? | Open | No — capability does not exist |
| [PQ-08](#pq-08--what-does-a-user-see-when-the-archidekt-credential-is-missing-expired-or-rejected) | What does a bad Archidekt credential look like? | Open | No — deferred by design |
| [PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08) | MCPB manifest `version` versus `P-08`? | Answered + implemented | Done |

Seven are settleable now in whole or in part: **OQ-02, OQ-03, OQ-12, PQ-03, PQ-04, PQ-06** at a
desk, and **OQ-07, OQ-08, OQ-09, OQ-11** with a handful of single spaced requests that need no
plugin, no harness, and no credential.

---

## `docs/MCP-PRD.md` — server questions

### OQ-01 — How should Scryfall syntax be surfaced to the model?

**Q.** `CAP-01` needs Claude to write good queries unprompted, so the syntax has to live
somewhere the model reads. A long tool description, a separate `card_search_syntax` tool, or an
MCP resource plus a compact description?

**A. Answered 2026-08-04: the compact description plus a skill holds, and nothing changes.**
Measured against a without-skill baseline in fresh sessions, the two configurations scored
identically on five of six operator families and differed only on `otag:`/`function:` — 3/3 with
the skill, 2/3 without, where the baseline fell back to oracle-substring matching when the user
named an effect the tag vocabulary does not echo.
[`src/tools/register.ts`](./src/tools/register.ts) is unchanged.

The qualification that matters more than the verdict: the shipped description already names `t:`,
`o:`, `f:`, `cmc`, `usd`, `otag:`, `art:` and regex, so the baseline was a model handed the
operator families, not one ignorant of them. This measures that *the split* works, **not** that
the skill carries those families — which argues for a shorter skill body rather than a longer tool
description.

**Owning entry:** [`MCP-PRD` OQ-01](./docs/MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model).
Evidence: [`docs/slices/TrackB-Slice9-results.md`](./docs/slices/TrackB-Slice9-results.md).

### OQ-02 — How verbose should a search result be?

**Q.** Full oracle text plus legalities plus prices for 175 cards is a large amount of context.
What is the default field set, and is there an opt-in verbose mode?

**A. The design decision is made; two details it depends on are still undecided, and none of it
is implemented.** Answered 2026-08-04: `legalities` is trimmed to the format the query names
(`f:`, `banned:`, `restricted:`), a small default set when it names none, and the full map moves
behind an opt-in. That rests on the one payload measurement the project has — 111 cards, 116,626
characters, `legalities` **54.5%** of the bytes and `oracle_text` **25.1%** — which exceeded a
harness tool-result ceiling at well under one page (issue #25). `oracle_text` is deliberately
untouched: it is the field the model reasons from.

Three gaps remain, and the first two are pure desk work:

1. **Which formats are in the "small default set"** is unspecified. Scryfall returns roughly 21.
2. **The opt-in's shape** is unspecified — a `legalities: "queried" | "default" | "all"` enum, a
   `verbose` boolean, or a `fields` list.
3. **A full 175-card page has still never been measured**, so whether the trim alone brings a
   full page under a realistic budget is unknown.

Note the doc-versus-code gap this leaves: `CAP-01` is marked **delivered** and gained criterion 13
for the trim, but its delivery note still reads "All twelve acceptance criteria are verified" and
the trim is not in `src/`.

**Resolves by:** deciding 1 and 2, implementing the trim with unit tests, then one live search to
measure a full page.
**Owning entry:** [`MCP-PRD` OQ-02](./docs/MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be), against [CAP-01](./docs/MCP-PRD.md#cap-01--card-search).

### OQ-03 — What is the bulk-data storage strategy, and when is it introduced?

**Q.** `oracle_tags`/`art_tags` and the CR text both need local persistence. Where does the cache
live on a user's machine, what triggers a refresh, and does first run block on a download?

**A. The location half is answered and shipped; the entry does not say so.**
[`src/config.ts`](./src/config.ts) resolves `CLAUDE_PLUGIN_DATA` when set and non-empty, otherwise
`%LOCALAPPDATA%\manabase` on Windows, `~/Library/Caches/manabase` on macOS, and
`$XDG_CACHE_HOME/manabase` or `~/.cache/manabase` elsewhere — read once at the entry point and
passed down, with the platform injectable so the branches are testable.
[`PLUGIN-PRD` §4.5](./docs/PLUGIN-PRD.md#45-persistent-data) records this as implemented
2026-08-04; `MCP-PRD`'s own `OQ-03` text is unchanged from its original wording, so a session
reading `§7` alone would think the location is undecided and could re-decide it differently.

**Open:** the refresh trigger and whether first run blocks on a download. See
[PQ-03](#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook)
for the plugin-side half, where the hook question can be closed on argument alone.

**Resolves by:** the tag-discovery capability spec, which is the first to need persistence. That
spec should use the bundled-manifest-comparison pattern rather than testing for file existence,
and read `jsonl_download_uri` from the API rather than constructing bulk URLs.
**Owning entry:** [`MCP-PRD` OQ-03](./docs/MCP-PRD.md#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced).

### OQ-04 — What is the behavior and blast radius of Archidekt's write API?

**Q.** Does bulk import replace or append? Does it preserve categories, commander designation,
companion, and maybeboard? What is the deck's state after a partial failure?

**A. Open, and deliberately untested.** Testing writes needs authentication and would mutate a
real deck, which a research session declined to do. This is the reason
[D-09](./docs/MCP-PRD.md#d-09--archidekt-writes-land-last) exists.

**Resolves by:** authenticated testing against a **disposable** deck, immediately before
specifying Archidekt deck writing — not before.
**Owning entry:** [`MCP-PRD` OQ-04](./docs/MCP-PRD.md#oq-04--what-is-the-behavior-and-blast-radius-of-archidekts-write-api).

### OQ-05 — Do Commander Spellbook or Archidekt impose rate limits?

**Q.** Neither documents limits and neither exposes rate-limit headers. Widened 2026-08-07:
**Moxfield is a third source in the same position**, and is covered by this question despite not
appearing in its heading, which cannot be renamed without breaking every link into it.

**A. Open. Absence of evidence is not absence of limits** — all three are recorded as *verified
absent, meaning unknown*. Until one of them answers,
[§3.7](./docs/MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis) is the standing rule:
identify honestly, self-throttle conservatively, treat a block as an answer.

Moxfield differs from the other two in having a plausible channel to ask, which is
[OQ-10](#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms).

**Resolves by:** asking the Commander Spellbook admins via their Discord — their About page
directs API questions there — and conservative self-throttling meanwhile.
**Owning entry:** [`MCP-PRD` OQ-05](./docs/MCP-PRD.md#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits).

### OQ-06 — Is Commander Spellbook's combo *data* licensed, as distinct from its code?

**Q.** The code is MIT. The data has no stated license and there is no ToS page.

**A. Open, low urgency.** The data is served anonymously by a project that exists to distribute
it, and EDHREC already consumes it.

**Resolves by:** asking the project admins — same Discord as
[OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits), so one message covers both.
**Owning entry:** [`MCP-PRD` OQ-06](./docs/MCP-PRD.md#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code).

### OQ-07 — How is `intentionallySkippedCardData` populated in Archidekt deck payloads, and what does its presence mean for a deck read?

**Q.** The field exists in the response and its name implies card data can be deliberately
absent, which would affect the completeness of a deck read.

**A. Open.** Nothing has been observed making it non-empty.

**Resolves by:** reading decks containing tokens, custom cards, and unreleased spoilers, and
observing when the field is non-empty. Reads are anonymous and need no plugin — single spaced
requests with the app-naming `User-Agent`, per
[§3.7](./docs/MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis). The cost is finding
candidate decks, not making the requests.
**Owning entry:** [`MCP-PRD` OQ-07](./docs/MCP-PRD.md#oq-07--how-is-intentionallyskippedcarddata-populated-in-archidekt-deck-payloads-and-what-does-its-presence-mean-for-a-deck-read).

### OQ-08 — Does the CR landing page ever offer more than one date-stamped TXT, and how are mid-cycle corrections handled?

**Q.** URL resolution depends on scraping a single `.txt` href. If two versions are ever listed,
"most recent" needs a rule.

**A. Open, and it splits cleanly.** Whether more than one `.txt` is listed **right now** is one
GET away. Whether the page *ever* lists two, and how mid-cycle corrections appear, needs watching
across a set release boundary and cannot be answered by a single observation.

**Resolves by:** re-checking the landing page across a set release boundary.
**Owning entry:** [`MCP-PRD` OQ-08](./docs/MCP-PRD.md#oq-08--does-the-cr-landing-page-ever-offer-more-than-one-date-stamped-txt-and-how-are-mid-cycle-corrections-handled).

### OQ-09 — Should price resolution fall back to EUR when no USD price exists?

**Q.** Delivered resolution is USD-only — `usd` → `usd_foil` → `usd_etched`, then
`no-price-data`. That is correct against the spec as written, and it returns *no price* for all
three paper printings of Black Lotus, which carry EUR prices only.

**A. Open, and the answer is not obviously yes.** A result mixing currencies without saying which
is worse than no price at all, and [D-06](./docs/MCP-PRD.md#d-06--pricing-from-scryfall) framed
pricing as one number per printing — a fallback makes it one number *in one of two currencies*,
a different contract. The cheap alternative is to keep USD-only and report the reason precisely
enough that the model can say "no USD price; this card trades in EUR."

**Resolves by:** first establishing how wide the gap is — how many paper cards have `eur`
populated and `usd` null — rather than generalizing from one card. Then either extending the price
shape with an explicit currency field, or recording the honest `no-price-data` answer as
sufficient. The gap measurement is two spaced `/cards/search` calls reading `total_cards`: paper
cards with a EUR price and no USD price, against the paper total. The negated-comparison form
(`eur>=0.01 -usd>=0.01 game:paper`) needs confirming against the API before the number is trusted.
**Owning entry:** [`MCP-PRD` OQ-09](./docs/MCP-PRD.md#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists).

### OQ-10 — Will Moxfield grant this application approved access, and under what terms?

**Q.** Moxfield operates a `User-Agent` whitelist granted by support — the only access policy it
publishes anywhere. Does an application of this shape qualify, on what terms, does a whitelist
cover reads only or gate the token endpoints too, and does approval carry a rate limit?

**A. Open, and asking is part of the spec work rather than politeness**
([§3.7](./docs/MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis)). The likely answer
is narrow: reads already work unchallenged without approval, so a whitelist may change nothing for
the read capability and everything for
[D-15](./docs/MCP-PRD.md#d-15--moxfield-writes-are-blocked-upstream-not-merely-last). A no, or
silence, resolves this as much as a yes — `moxfield-public` issue #143 has had no maintainer
comment in eight and a half months, so a support channel that answers cannot be assumed.

**Sequencing worth acting on:** the reply latency is the long pole and the clock starts when the
message is sent, so sending early costs nothing even though the capability is far off.

**Resolves by:** contacting Moxfield support **before** Moxfield deck reading ships, describing the
application honestly — local install, 5–20 users, one deck read per user request, no
redistribution — and recording the reply verbatim in `§4.8`, including a non-reply after a stated
interval.
**Owning entry:** [`MCP-PRD` OQ-10](./docs/MCP-PRD.md#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms).

### OQ-11 — Does Moxfield mask private and unlisted decks behind the same 404 as an unknown ID?

**Q.** An unknown deck ID returns a bare RFC 9110 404 carrying no reason **[verified]**. No
private or unlisted deck was tested, so whether Moxfield collapses those cases the way Archidekt
does is unknown.

**A. Open, and the tempting move — assuming parity with Archidekt and writing one error message
for both platforms — is the wrong one.** If private decks 404 identically, the message must cover
all causes without asserting one
([§3.6](./docs/MCP-PRD.md#36-error-surface)). If Moxfield distinguishes them, the capability can
say something genuinely more useful than the Archidekt equivalent can, and should. Assuming parity
either over-claims on Moxfield or under-claims on Archidekt, and the failure is silent in both
directions.

**Resolves by:** reading three decks the author owns on Moxfield — one public, one unlisted, one
private — as an anonymous caller, and recording all three status codes and bodies. Three requests,
no plugin, no credential the server would ever hold; the only input needed is the three deck IDs.
**Owning entry:** [`MCP-PRD` OQ-11](./docs/MCP-PRD.md#oq-11--does-moxfield-mask-private-and-unlisted-decks-behind-the-same-404-as-an-unknown-id).

### OQ-12 — What is the normalized deck shape, and does one tool serve both platforms or two?

**Q.** Archidekt and Moxfield answer the same user question and disagree structurally about how.
Commander designation is `categories: ["Commander"]` on a card in Archidekt and a dedicated
`commanders` board in Moxfield; Moxfield has twelve fixed boards where Archidekt has free-form
categories; both embed card detail that should come from Scryfall instead. Whatever the tool
returns has to be **one** shape, because every downstream capability consumes the shape rather
than the platform.

**A. Open — and it is the one open question that is fully designable at a desk today.** Both
platform records are verified and field-complete:
[§4.5](./docs/MCP-PRD.md#45-archidekt) for Archidekt's card fields, categories and 404 behavior,
and [§4.8.1](./docs/MCP-PRD.md#481-the-deck-payload-is-enormous--measured) for Moxfield's twelve
boards, per-card fields, deck-level fields, and the 1.63 MB measurement that puts a passthrough
off the table from the first line of the spec.

The shape question has a strong candidate already recorded: deliberately thin — name, quantity,
board, finish, `scryfall_id`, plus deck-level format and identity — with card detail resolved
through [§4.1.2](./docs/MCP-PRD.md#412-batch-resolution) batch lookup, which is smaller *and* more
correct than either platform's embedded copy.

The one-tool-versus-two question is the one that bites, and note what it does **not** depend on:
one tool costs one schema instead of two under either answer to
[PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports),
so the choice does not wait on that measurement. Note also that
[D-11](./docs/MCP-PRD.md#d-11--tool-naming-convention) is a naming *convention* and its
`deck_read_archidekt` is an example, not a mandate — `deck_read` satisfies `domain_verb_noun`
either way, so choosing one tool needs no amendment to a locked decision.

**One field the record does not carry:** Archidekt's `deckFormat` is an integer, and no
integer→name mapping is recorded anywhere. A normalized string `format` needs that table, and it
can only come from live data.

**Resolves by:** the Archidekt deck-reading spec session, which is first per
[D-13](./docs/MCP-PRD.md#d-13--deck-platform-order-archidekt-first-moxfield-second) and therefore
owns this. It must check each field against the Moxfield record rather than designing for
Archidekt alone — designing for one platform and discovering the second does not fit is the
outcome `D-13`'s ordering exists to prevent.
**Owning entry:** [`MCP-PRD` OQ-12](./docs/MCP-PRD.md#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two).

---

## `docs/PLUGIN-PRD.md` — plugin questions

### PQ-01 — Do an MCP server's tool schemas count toward the always-on cost that `claude plugin details` reports?

**Q.** [§4.6](./docs/PLUGIN-PRD.md#46-context-cost-accounting) could not establish it either way,
and it is the one cost figure [PC-02](./docs/PLUGIN-PRD.md#pc-02--bundled-mcp-server) cannot state.

**A. Open.** It matters more than a reporting detail: unlike a skill description, a tool schema
**cannot be budget-trimmed**, so if schemas are a real always-on cost then tool count and
description length in `MCP-PRD` become a context-budget decision rather than a formatting one.
The current inference is that they are *not* counted — the server is not running when the command
executes — but the docs state nothing either way.

**Resolves by:** running `claude plugin details` on a plugin that bundles an MCP server and
comparing the reported always-on total against the same plugin with the server removed. Needs an
installed plugin, so it is blocked to a machine that can install one.
**Owning entry:** [`PLUGIN-PRD` PQ-01](./docs/PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports).

### PQ-02 — What is this plugin's measured always-on cost, and does it fit alongside what the author already has installed?

**Q.** [§3.1](./docs/PLUGIN-PRD.md#31-context-budget)'s budget is shared, and the author's
`dotnet-plugin` already spends ~1,722 always-on tokens across 20 skills. The plugin's own
footprint looks small; the aggregate is the question.

**A. Open, and it is the question that decides whether `§3.1`'s silent degradation is a live risk
or a theoretical one.** No context-cost measurement of any kind exists yet, which is also why
[PC-01](./docs/PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s criterion 2 and
[PC-02](./docs/PLUGIN-PRD.md#pc-02--bundled-mcp-server)'s criteria 5, 8 and 10 are unverified.

**Resolves by:** `/doctor`, which estimates the skill listing against the budget and names its
biggest contributors, plus `/context`, whose Skills row reports the listing size after the budget
is applied. Both need the plugin installed and the skill actually in the listing — the same
precondition [Slice 9](./docs/slices/TrackB-Slice9.md) established after the frontmatter defect.
**Owning entry:** [`PLUGIN-PRD` PQ-02](./docs/PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed).

### PQ-03 — What triggers a refresh of the bulk data and the Comprehensive Rules cache, and should it ever be a `SessionStart` hook?

**Q.** Recording a disagreement rather than a gap. A session-start hook is the obvious mechanism,
but it fires on **every** session in **every** project — for 5–20 people that is a network call at
every Claude Code launch, almost all of them in projects with nothing to do with Magic.

**A. Open — but the hook half is decidable on argument alone, and the argument runs one way.**
Three reasons converge: the every-project cost above; Phase 1 ships no hook deliberately; and
[§3.4](./docs/PLUGIN-PRD.md#34-cross-platform-reach) makes the first component to need a hook the
owner of the exec-form and Windows-shell problem rather than an inheritor of a solution. Answering
"never a `SessionStart` hook" now is a standing constraint that costs nothing and pre-empts
nothing, and it leaves the genuinely coupled parts — storage layout, and whether first use blocks
on a download — to the capability spec that owns them.

**Resolves by:** deciding it as part of the capability that first needs local persistence — tag
discovery or rules lookup. This is the plugin-side half of
[`MCP-PRD` OQ-03](./docs/MCP-PRD.md#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced).
**Owning entry:** [`PLUGIN-PRD` PQ-03](./docs/PLUGIN-PRD.md#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook).

### PQ-04 — How would the author detect that a friend's skill listing has been budget-trimmed?

**Q.** [§3.1](./docs/PLUGIN-PRD.md#31-context-budget)'s degradation is silent and `/doctor` is
local. A friend whose listing overflowed would experience
[PC-01](./docs/PLUGIN-PRD.md#pc-01--scryfall-query-craft) as "sometimes it doesn't seem to know
about Magic" and would probably not report it as a bug at all.

**A. Open, and likely a documentation answer — with one mitigation the question does not name.**
`PC-01` cannot be robust to having no description, because the description *is* the invocation
mechanism. But `§3.1` records that trimming drops descriptions **and keeps names**, so a trimmed
skill stays invocable: the README line can be stronger than "run `/doctor`" — *if Claude does not
reach for Magic knowledge on its own, invoke `manabase:scryfall-query-craft` by name, then run
`/doctor`*. That is decidable at a desk. The part that still needs a harness is whether `/doctor`
actually names this plugin among the contributors, which
[Slice 10](./docs/slices/TrackC-Slice10.md) gets for free.

**Resolves by:** deciding whether a documented README line is sufficient — likely yes, but confirm
it rather than assuming.
**Owning entry:** [`PLUGIN-PRD` PQ-04](./docs/PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed).

### PQ-05 — Should the plugin be submitted to the community marketplace once it is stable?

**Q.** Anthropic maintains `claude-plugins-community`, where third-party submissions land after
review and automated safety screening. This is not the hosted marketplace rejected in
[§8](./docs/PLUGIN-PRD.md#8-out-of-scope) — it is someone else's marketplace, requiring no
infrastructure from this project, and it would change which marketplace users add rather than
reduce the two-command install.

**A. Open by its own terms, and it should stay that way for now.** Against it: a public listing
invites an audience larger than 5–20, and every constraint in `PLUGIN-PRD` was written for 5–20.
It is decidable at a desk in the sense that no measurement gates it, but its resolution clause
says *after Phase 1 is stable*, and Phase 1 is not — `PC-01` criterion 2 and `PC-02` criteria 5, 8
and 10 are unverified. Worth recording the asymmetry: this is reversible in one direction only.

**Resolves by:** an explicit decision after Phase 1 is stable. Not urgent, and worth deciding
deliberately rather than drifting into.
**Owning entry:** [`PLUGIN-PRD` PQ-05](./docs/PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable).

### PQ-06 — What keeps the committed `dist/` honest?

**Q.** [P-09](./docs/PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) accepts
committed build output as the cheaper cost, but it creates a release where `dist/` does not match
`src/` — and because the harness runs whatever is committed, that failure is invisible until
someone reports wrong behavior. Widened by
[P-14](./docs/PLUGIN-PRD.md#p-14--two-distribution-targets-one-source): a `.mcpb` freezes whatever
`dist/` was committed at pack time and an installed bundle never re-pulls, so there are two ways
to ship a stale build and the second is worse.

**A. Half-answered 2026-08-04, and the remaining half is closable here.** Both halves have a
mechanism: `.github/workflows/release.yml` rebuilds `dist/` and fails the release on a diff, and
`scripts/pack-mcpb.mjs` refuses to pack when `dist/index.js` is older than anything under `src/`.
Two reasons it is not resolved — the CI gate **has never run**, because no tag has been pushed and
it cannot be exercised on the author's machine where `core.autocrlf=true` makes `dist/index.js`
report modified with an empty diff after every build; and both mechanisms fire at *release* time,
leaving every ordinary commit in exactly the drift this question describes.

`.github/workflows/` currently holds `release.yml` and nothing else, so **no check runs on a pull
request or an ordinary push.** A `ci.yml` on `pull_request` + `push: main` running typecheck →
test → build → `git diff --exit-code -- dist/` closes that half, and it also runs the
rebuild-and-diff mechanism for the first time — the local CRLF false alarm is a working-tree
artifact and does not apply to a Linux runner that checks out LF. This needs no harness: it needs
a branch and a push.

The user-facing half stays open regardless: a released bundle carries its `dist/` until someone
reinstalls, because there is no update path. The closest mitigation is already implemented — an
untagged bundle stamps itself `0.0.0-dev+<commit>`, so a hand-packed artifact cannot be mistaken
for a release.

**Resolves by:** a check on ordinary commits, plus the release gate actually executing once.
Scheduled as [Slice 11](./docs/slices/TrackC-Slice11.md), which is unblocked.
**Owning entry:** [`PLUGIN-PRD` PQ-06](./docs/PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest).

### PQ-07 — Is deck optimization a skill or an agent?

**Q.** Both are paid always-on for their description, so the question is whether the work needs
its own context window — a long analysis that would otherwise crowd the conversation — rather than
which one it resembles.

**A. Open, and not answerable yet.** Worth carrying: a plugin-shipped agent cannot declare
`hooks`, `mcpServers`, or `permissionMode`, though it reaches this plugin's server through the
normal scoped tool name regardless.

**Resolves by:** specifying the component, which cannot happen until the deck-reading capability
it depends on exists.
**Owning entry:** [`PLUGIN-PRD` PQ-07](./docs/PLUGIN-PRD.md#pq-07--is-deck-optimization-a-skill-or-an-agent).

### PQ-08 — What does a user see when the Archidekt credential is missing, expired, or rejected?

**Q.** Deferred deliberately. [P-13](./docs/PLUGIN-PRD.md#p-13--no-user-configuration-in-phase-1)
means there is no credential in Phase 1, and
[D-09](./docs/MCP-PRD.md#d-09--archidekt-writes-land-last) puts Archidekt writes last.

**A. Open.** The constraint that makes it non-trivial when it arrives: Archidekt masks non-public
decks as an indistinguishable 404, and
[§3.6](./docs/MCP-PRD.md#36-error-surface) forbids error text that claims more than is known — so
"your credential expired" may be an unsupportable claim even when it is the likely cause.

**Deliberately not widened to Moxfield, 2026-08-07.** Moxfield has no working third-party
authentication path, so **there is no Moxfield credential to be missing, expired, or rejected**.
If [OQ-10](#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms)
comes back yes, this widens then and not before.

**Resolves by:** specifying the Archidekt write capability in `MCP-PRD`, then the component that
surfaces it. Not before.
**Owning entry:** [`PLUGIN-PRD` PQ-08](./docs/PLUGIN-PRD.md#pq-08--what-does-a-user-see-when-the-archidekt-credential-is-missing-expired-or-rejected).

### PQ-09 — How does the MCPB manifest `version` relate to P-08?

**Q.** [P-08](./docs/PLUGIN-PRD.md#p-08--version-scheme) leaves `plugin.json`'s `version` unset
during development on purpose. The MCPB manifest has no such option — `version` is required — so
three fields express "which build is this" and the third's place was unanswered.

**A. Answered and implemented 2026-08-04: the pack step stamps the manifest `version` from the
commit being packed.** `scripts/pack-mcpb.mjs` reads a `MANABASE_BUNDLE_VERSION` override first,
then an exact git tag, and falls back to `0.0.0-dev+<short-sha>`; a leading `v` is stripped and a
non-semver result is refused rather than packed. Nothing is hand-synced and no fourth copy is
created, which was the trap this question named.

**A tag versions the bundle only.** `plugin.json` stays version-less, `P-08` is untouched, and
[Slice 13](./docs/slices/TrackC-Slice13.md) still owns the plugin-version switchover. The dev
fallback matters as much as the tag path: an untagged bundle announces itself as one, so a
hand-packed artifact can never be mistaken for a release in an install dialog that shows the
version.

**Owning entry:** [`PLUGIN-PRD` PQ-09](./docs/PLUGIN-PRD.md#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08).
