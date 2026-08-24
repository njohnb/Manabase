# MTG MCP Server — Add Capability Session

Reusable. Paste one or more capability requests into the slot below and run.

---

**Read `docs/MCP-PRD.md` in full before doing anything else.** It is the source of truth. This
conversation is not — everything you need is in the document, and anything you decide here
that matters must end up back in it.

**Do not write implementation code.** Your output is an edit to `docs/MCP-PRD.md`.

**This session edits that one file.** Not `docs/PLUGIN-PRD.md` — if the request is really about
what the user installs or experiences, it is a PC there and the component prompt owns it. Say so
and stop. Not `docs/DEV-ROADMAP.md`, `README.md`, or `CLAUDE.md` — a capability is specified here
and scheduled later, and those files are reconciled at slice closeout by the `doc-sync` subagent.

## What to do

1. **Read the PRD.** Sections 2 (locked decisions) and 3 (constraints) especially.
2. **Check the request against them.** If a capability conflicts with a locked decision or a
   constraint, stop and tell me before writing anything. Don't quietly design around it and
   don't re-open the decision — surface the conflict and let me choose.
3. **Research only what's new.** If the capability needs a source already in section 4, use
   what's recorded there. If it introduces a new one, research it properly and add a
   subsection with the date verified. Re-verify an existing entry only if it's stale enough
   to matter or the capability depends on a detail the entry doesn't cover.
   - **Section 4 is append-only.** It is a dated research record, not a description of the
     present. When reality has moved, append a dated addendum — §4.1.3 is the pattern. Never
     overwrite what an earlier session verified.
   - **A live probe obeys §3.4 and §3.7.** Never deliberately provoke a 429: card endpoints are
     capped at 2/sec and everything else at 10/sec, so space the calls by hand. Never defeat a
     third party's bot protection to reach a source — no challenge solver, no headless browser,
     no browser-impersonating User-Agent, and no exception for "it was the only thing that
     worked." A block is an answer. Record it and specify around it.
4. **Ask questions before writing**, batched. A capability specified from guesswork is worse
   than one that took an extra round trip.
5. **Write the CAP block(s)** using the template at the top of section 5, verbatim. Next
   available ID, never reused. Four things the template does not say:
   - **Never restate a decision — cite it by ID.** A duplicated `D-` or `OQ-` text drifts, and a
     later session cannot tell which copy is current.
   - **Acceptance criteria are numbered and cited by number from outside the document** — a slice
     result says "criterion 13." Append; never renumber, reorder, or delete one.
   - **Tool names follow `D-11`**, and a name a decision already fixed is inherited, not
     re-decided: deck reading is one tool called `deck_read` per `OQ-12`.
   - **If a dependency is unresolved, write `Status: proposed` and a blocking open question in
     section 7.** A specified block resting on a guess is worse than a proposed one that names
     what is missing.
6. **Update sections 6, 7, and 9.** Phase assignment with reasoning, any new open questions,
   a revision log line. If the new capability changes the phasing of existing ones, say so
   explicitly rather than silently rewriting section 6.
   - **Section 6 carries a queued-capability table and a count.** A capability specified here
     leaves that table: remove its row, and move the count in the sentence above it ("Ten
     capabilities are queued") down by one.
   - **A new open question also needs a row in `OPEN-QUESTIONS.md`**, whose intro counts them.
     That file is derived and binds nothing — the PRD entry is authoritative — but nothing else
     catches it when it goes stale.
7. **Link every reference you add, then run `npm run lint:docs`.** Inside `docs/`, a `§`, an ID, a
   slice number, or a repo path in prose is a markdown link to the thing it names — same-file
   `#anchor`, cross-file `./PLUGIN-PRD.md#anchor`. Backticks are not a link. Adding a reference
   and linking it are the same edit, never a follow-up. Anchor slugs are unforgiving, the checker
   runs in CI, and this prompt file is exempt: `docs/prompts/**` carries no links by design.
8. **Report what changed** — which sections, and anything you couldn't resolve.

## What not to touch

Sections 1, 2, 3, and 8 stay as they are unless the capability genuinely forces a change — in
which case raise it with me first rather than editing. If you find yourself wanting to revise
a locked decision to make a capability fit, that's a signal the capability needs rethinking,
or that I need to reopen the decision deliberately.

Section 4 is not off limits, but it is append-only — a new subsection or a dated addendum, never
a rewrite.

Existing CAP blocks stay as they are unless the new capability creates a real dependency, in
which case update only the `Depends on` line of the affected block. Their acceptance criteria are
never renumbered.

## Capability request

<!-- PASTE ONE OR MORE CAPABILITY DESCRIPTIONS HERE -->

---

# Appendix — queued capabilities

Copy into the slot above. **Two or three per session**, grouped by what they share — running
all ten at once produces ten shallow specs, which is the thing this format exists to
prevent. Suggested grouping is noted on each.

These ten match section 6's queued table. **A note here is the request; section 4 is what has
actually been verified. Where they disagree, section 4 wins** — several notes were written before
the research they ask for landed, and asking again for a fact already recorded wastes a session
and risks a needless live call.

### Combo discovery
*Group with: card search follow-ups. Needs Commander Spellbook.*

Find combos involving a given card, or combos available within a given decklist. Uses
Commander Spellbook, and §4.4 is conclusive on the mechanism — `/find-my-combos` is the
discovery primitive, anonymous access works, and the 606 MB `variants.json` is the trap to
avoid — so the API is not what needs research here. What stays open is `OQ-05` (no documented
rate limit, meaning unknown rather than unlimited) and `OQ-06` (the backend code is MIT; the
combo *data* carries no stated license). Neither blocks a spec. Both belong in the block's open
questions rather than being resolved by assertion.

### Read an Archidekt deck
*Group with: decklist export, decklist pricing. These three form the deck-analysis loop.*

Read a deck so Claude can see the current list and reason about it.

Three things are already settled and must not be re-decided. §4.5 records that unauthenticated
reads work on public decks and how a non-public one presents. `D-13` makes Archidekt the first of
two platforms. And `OQ-12` fixes the normalized shape and one tool named `deck_read`, which the
Moxfield read later reuses — this session inherits that shape rather than designing one, and
everything downstream consumes it rather than a platform payload.

Two things are genuinely open and belong in the block: `OQ-07` (`intentionallySkippedCardData` —
what populates it and what its presence means for a read), and Archidekt's `deckFormat`
integer→name table, which no session has written down yet.

### Read a Moxfield deck
*Second of the two platforms per `D-13`. Specify after the Archidekt read, never before or with it.*

The same capability shape served from a second source. It consumes the `OQ-12` shape and does not
get to change it; if that shape is not written yet, this session is out of order.

Two things make it its own session rather than a footnote on the Archidekt one. **One deck read
measured 1.63 MB** (§4.8.1) — roughly 14× the payload that already exceeded a harness tool-result
ceiling in issue #25, with `tokens` and `tokenMappings` alone a third of it — so trimming is the
first line of the spec, not a refinement, and every card carrying `scryfall_id` is what makes the
trim obvious. And §3.7 binds hardest here: Moxfield sits behind bot protection, the top search
result for its API is a working `cloudscraper` proxy, and reaching for one is out of bounds no
matter how well it works. Identify honestly and degrade.

`OQ-10` (will Moxfield grant approved access, and on what terms) and `OQ-11` (are private and
unlisted decks masked behind the same 404 as an unknown ID) both belong in the block.

### Export decklist as Arena text
*Group with: read deck, decklist pricing.*

Emit a proposed decklist as MTG Arena-format text (`1 Sol Ring`, `1 Command Tower`) that I
paste into Archidekt myself. This is the stand-in for write support and should carry real
weight until writes land. Note what's lost versus true write access — category assignments,
commander designation, maybeboard. It transforms the `OQ-12` shape, so it inherits both deck
platforms at once or neither.

### Price a decklist
*Group with: read deck, decklist export.*

Total value, most expensive cards, and the cost delta of a proposed change. Prices come from
Scryfall per `D-06`, and §4.1.3's three traps apply per card. Make sure a price carries its age
so I'm never quoted a stale number without knowing it.

Half the batching question is already answered: §4.1.2 records `POST /cards/collection` at 75
identifiers per request, so a 100-card deck is two calls, not a hundred. What is left is what
happens to an identifier the endpoint does not resolve. `OQ-09` is answered too — no EUR
fallback, and a paper card with no USD price is reported with a distinct `no-usd-price` reason
carrying the EUR figure, never as missing data and never as `$0`.

### Find budget alternatives
*Group with: pricing, or run alone — it's the hardest to specify.*

Cards that fill a similar role for meaningfully less money. "Similar role" is the whole
problem and it leans on search and combo data more than on price. Don't hand-wave it — if the
mechanism isn't specifiable yet, say so and record it as an open question rather than writing
vague acceptance criteria.

### Write a deck to Archidekt
*Run alone. Highest risk in the set.*

Read, clear, overwrite. `D-09` says this lands last, and `OQ-04` — the write API's behavior and
blast radius — is unresolved and is the point of the session. **Never specify it alongside the
Moxfield write.** The two are queued for different reasons: this one is deferred by choice and is
buildable today; that one is blocked upstream and is not.

The write API is undocumented
and unstable and the operation is destructive, so the acceptance criteria need to cover
failure modes, not just the happy path: partial failure, what survives an overwrite, and
whether a backup-before-write step is warranted. Credentials are the user's session cookie
and `X-CSRFToken` from browser DevTools, held in their own environment per the local
distribution model — including what happens when a cookie expires, which will be the most
common support issue.

### Write a deck to Moxfield
*Do not schedule. Listed so a session does not mistake it for Archidekt's write and pick it up.*

**Blocked upstream, not merely last** (`D-15`). The token endpoints challenge even
support-whitelisted callers, and the report has sat unanswered since 2025-11-23, so there is no
path §3.7 permits. It unblocks through `OQ-10` or not at all. Specifying it now produces
acceptance criteria that nothing can satisfy, which is worse than an empty queue slot.

### Tag discovery
*Group with: card search follow-ups.*

Scryfall's Tagger has community tags for concepts that are hard to search otherwise — art
subjects and functional roles. **Searching by them is already covered by CAP-01**, since
`otag:`/`function:`/`oracletag:` and `art:`/`atag:`/`arttag:` are ordinary search operators.
The capability is *discovery*: going from a fuzzy concept ("cards that punish attacking",
"art with cats") to the right tag slug among thousands.

That needs the Tags API bulk data locally, which makes this the first capability to require
local persistence — `D-07`'s cache split and `OQ-03`'s storage strategy both land on it. Tags
carry a `parent_ids`/`child_ids` hierarchy, and bulk data holds only *direct* taggings — a
parent like `animal` has none of its own, so you traverse children to collect them.

Its two constraints are already recorded and must be cited rather than restated: §3.5 covers the
community-maintained data and the per-tag disable, and §4.3 records that slugs are not permanent
identifiers, so track the UUID.

### Comprehensive Rules lookup
*Run alone. Larger than the others.*

Rule text by number, keyword search across rules, and glossary definitions.

The .txt is ~950k characters, which sounds like it needs a vector store. It doesn't. The
document is ~3,000 individually numbered rules averaging a few hundred characters, in nine
sections with a glossary at the end. Chunk on rule number and it's a small local index:
exact lookup by number, plain keyword search over short records. **Do not propose embeddings,
a vector store, or an external service.**

`D-08` already decides that the rules are fetched at runtime and never bundled, so that is not a
question this session reopens.

Parsing notes to verify: use the .txt (cleanest of the three formats); subrule letters skip
`l` and `o` to avoid confusion with 1 and 0, so don't assume a contiguous alphabet; the
download URL is date-stamped and changes each update, so resolve the current link from the
rules landing page rather than hardcoding a filename. `OQ-08` is half answered — §4.6 saw one
.txt on the page, and the rule that follows is **take the most recent by date stamp, never the
first match**; whether the page ever carries a mid-cycle correction needs a release boundary to
observe. Updates land every few months alongside set releases, so this needs a refresh story like
the card data has — and per `PQ-03` that story is never a `SessionStart` hook.

Keep this distinct from Scryfall's per-card Oracle rulings, which are a different dataset and
often the better answer to "why doesn't this interaction work." If per-card rulings aren't
covered by CAP-01, note the gap.
