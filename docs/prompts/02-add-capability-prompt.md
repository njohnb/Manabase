# MTG MCP Server — Add Capability Session

Reusable. Paste one or more capability requests into the slot below and run.

---

**Read `docs/MCP-PRD.md` in full before doing anything else.** It is the source of truth. This
conversation is not — everything you need is in the document, and anything you decide here
that matters must end up back in it.

**Do not write implementation code.** Your output is an edit to `docs/MCP-PRD.md`.

## What to do

1. **Read the PRD.** Sections 2 (locked decisions) and 3 (constraints) especially.
2. **Check the request against them.** If a capability conflicts with a locked decision or a
   constraint, stop and tell me before writing anything. Don't quietly design around it and
   don't re-open the decision — surface the conflict and let me choose.
3. **Research only what's new.** If the capability needs a source already in section 4, use
   what's recorded there. If it introduces a new one, research it properly and add a
   subsection with the date verified. Re-verify an existing entry only if it's stale enough
   to matter or the capability depends on a detail the entry doesn't cover.
4. **Ask questions before writing**, batched. A capability specified from guesswork is worse
   than one that took an extra round trip.
5. **Write the CAP block(s)** using the template at the top of section 5, verbatim. Next
   available ID, never reused.
6. **Update sections 6, 7, and 9.** Phase assignment with reasoning, any new open questions,
   a revision log line. If the new capability changes the phasing of existing ones, say so
   explicitly rather than silently rewriting section 6.
7. **Report what changed** — which sections, and anything you couldn't resolve.

## What not to touch

Sections 1, 2, 3, and 8 stay as they are unless the capability genuinely forces a change — in
which case raise it with me first rather than editing. If you find yourself wanting to revise
a locked decision to make a capability fit, that's a signal the capability needs rethinking,
or that I need to reopen the decision deliberately.

Existing CAP blocks stay as they are unless the new capability creates a real dependency, in
which case update only the `Depends on` line of the affected block.

## Capability request

<!-- PASTE ONE OR MORE CAPABILITY DESCRIPTIONS HERE -->

---

# Appendix — queued capabilities

Copy into the slot above. **Two or three per session**, grouped by what they share — running
all eight at once produces eight shallow specs, which is the thing this format exists to
prevent. Suggested grouping is noted on each.

### Combo discovery
*Group with: card search follow-ups. Needs Commander Spellbook.*

Find combos involving a given card, or combos available within a given decklist. Uses
Commander Spellbook — check section 4 for what was found about its API, and if the research
was inconclusive, resolve that before specifying.

### Read an Archidekt deck
*Group with: decklist export, decklist pricing. These three form the deck-analysis loop.*

Read a deck so Claude can see the current list and reason about it. Section 4 should record
whether unauthenticated reads work on public decks and what happens on private ones; if that
came back uncertain, it's a blocking open question, not a detail.

### Export decklist as Arena text
*Group with: read deck, decklist pricing.*

Emit a proposed decklist as MTG Arena-format text (`1 Sol Ring`, `1 Command Tower`) that I
paste into Archidekt myself. This is the stand-in for write support and should carry real
weight until writes land. Note what's lost versus true write access — category assignments,
commander designation, maybeboard.

### Price a decklist
*Group with: read deck, decklist export.*

Total value, most expensive cards, and the cost delta of a proposed change. Prices come from
Scryfall per the locked decision. Work out the API cost of pricing a 100-card deck and
whether that needs batching, and make sure a price carries its age so I'm never quoted a
stale number without knowing it.

### Find budget alternatives
*Group with: pricing, or run alone — it's the hardest to specify.*

Cards that fill a similar role for meaningfully less money. "Similar role" is the whole
problem and it leans on search and combo data more than on price. Don't hand-wave it — if the
mechanism isn't specifiable yet, say so and record it as an open question rather than writing
vague acceptance criteria.

### Write a deck to Archidekt
*Run alone. Highest risk in the set.*

Read, clear, overwrite. Locked decision says this lands last. The write API is undocumented
and unstable and the operation is destructive, so the acceptance criteria need to cover
failure modes, not just the happy path: partial failure, what survives an overwrite, and
whether a backup-before-write step is warranted. Credentials are the user's session cookie
and `X-CSRFToken` from browser DevTools, held in their own environment per the local
distribution model — including what happens when a cookie expires, which will be the most
common support issue.

### Tag discovery
*Group with: card search follow-ups.*

Scryfall's Tagger has community tags for concepts that are hard to search otherwise — art
subjects and functional roles. **Searching by them is already covered by CAP-01**, since
`otag:`/`function:`/`oracletag:` and `art:`/`atag:`/`arttag:` are ordinary search operators.
The capability is *discovery*: going from a fuzzy concept ("cards that punish attacking",
"art with cats") to the right tag slug among thousands.

That needs the Tags API bulk data locally. Tags carry a `parent_ids`/`child_ids` hierarchy,
and bulk data holds only *direct* taggings — a parent like `animal` has none of its own, so
you traverse children to collect them. Two constraints: Scryfall says tag slugs are not
permanent identifiers (track the UUID), and recommends a way to disable individual tags,
since the data is community-maintained and moderation isn't guaranteed.

### Comprehensive Rules lookup
*Run alone. Larger than the others.*

Rule text by number, keyword search across rules, and glossary definitions.

The .txt is ~950k characters, which sounds like it needs a vector store. It doesn't. The
document is ~3,000 individually numbered rules averaging a few hundred characters, in nine
sections with a glossary at the end. Chunk on rule number and it's a small local index:
exact lookup by number, plain keyword search over short records. **Do not propose embeddings,
a vector store, or an external service.**

Parsing notes to verify: use the .txt (cleanest of the three formats); subrule letters skip
`l` and `o` to avoid confusion with 1 and 0, so don't assume a contiguous alphabet; the
download URL is date-stamped and changes each update, so resolve the current link from the
rules landing page rather than hardcoding a filename; updates land every few months alongside
set releases, so this needs a refresh story like the card data has.

Keep this distinct from Scryfall's per-card Oracle rulings, which are a different dataset and
often the better answer to "why doesn't this interaction work." If per-card rulings aren't
covered by CAP-01, note the gap.
