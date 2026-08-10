# Ideas — pre-triage

**This file binds nothing and schedules nothing.** An entry here is a thought, not a commitment.
The three documents in `docs/` are authoritative for everything an entry references; if an entry
disagrees with a PRD, the PRD is right and the entry is stale — fix it here, never there.

**The lane boundary comes first, because it is the part a cold session gets wrong.** This file sits
strictly *upstream* of the pipeline:

```
IDEAS.md  ->  triage  ->  CAP/PC block + slice  ->  design  ->  questions  ->  OPEN-QUESTIONS.md / §7
   ^                                                                                    ^
   a new thing the project might do,                    a question inside work already
   with no block and no slice yet                       triaged — a plan or a Slice.md
```

A question that arises *inside* work already triaged belongs in `OPEN-QUESTIONS.md` and §7 of the
owning PRD, **never here**. An idea here has no `CAP`, no `PC`, no slice, and no phase. The
discriminator is one test: *does it name an existing `CAP`, `PC`, slice, or plan and ask something
about it?* If yes it is a question and it is in the other lane.

It exists because the pipeline starts at "append a `CAP`/`PC` block", and there was nowhere to hold
something that has not earned one. An idea's only legal resting place before this file was a block
with `Phase: unassigned` — which already requires the idea to be well-formed enough to earn a block.
Anything below that bar became narrative prose in `docs/DEV-ROADMAP.md` §2 or a sentence buried
inside a slice entry, findable only by grep, listed nowhere.

**An entry is never deleted.** A promoted or dropped entry keeps its row with a pointer to where it
went. This mirrors §7's rule that questions stay until answered — they are not dropped.

**`IDEA-` is deliberately outside the binding ID namespaces** (`D-`, `P-`, `CAP-`, `PC-`, `OQ-`,
`PQ-`) so an idea ID can never be mistaken for a decision. IDs are stable and never reused,
including one whose entry is dropped or superseded.

Entries are `### IDEA-0N — <short name>` followed by a fixed 13-field bullet list, matching the
`CAP`/`PC` block style. `.claude/commands/idea.md` defines the fields, and researches two of them —
`Constrained by` and `Conflicts / prior art` — rather than asking the author.

`Ready to triage?` below answers one specific question, the analog of `OPEN-QUESTIONS.md`'s proven
"Settle now?" column: *can this be moved forward at a desk, or does it need a live harness, a third
party, or a capability that does not exist yet?*

| ID | Idea, short | Captured | Likely home | Status | Ready to triage? |
|---|---|---|---|---|---|
| [IDEA-01](#idea-01--cache-scryfall-responses-in-process) | Cache Scryfall responses in-process | 2026-08-10 | `CAP` in `MCP-PRD` — guess | untriaged | **Yes — desk work** |

---

### IDEA-01 — Cache Scryfall responses in-process

- **Captured:** 2026-08-10 — session, while building `/idea` itself. First entry in this file.
- **Status:** untriaged
- **As stated:** "caching and combining multiple scryfall queries into 1 "list" query to save time
  and api calls"
- **Problem:** Every card-endpoint call shares one 2/second lane, and nothing anywhere memoizes a
  response. Four costs follow, and they are independent of any fix: a multi-query session spends
  seconds purely in throttle; an identical query re-issued within a session spends a rate-limit slot
  on an answer already held; that spend counts against a budget where sustained overage risks the
  application for **every** user, not just this one; and a repeated large payload is paid twice in
  context, which is issue #25 territory — 111 cards measured 116,626 characters, already over a
  harness tool-result ceiling.
- **Sketch:** An in-memory response cache living inside the server process, constructed at
  `src/index.ts` and passed down beside the client, fronting `client.get` so every card endpoint
  benefits rather than `cardSearch` alone. A hit costs no request and no rate-limit slot. Scope is
  the process: it lives and dies with the stdio server and persists nothing. **It stores responses
  Scryfall computed; it never evaluates a query** — see the guardrail in `Conflicts / prior art`.
  Not a spec.
- **Likely home:** `CAP` in `docs/MCP-PRD.md` — **a guess to be checked, not a decision.** It
  changes what the server does, so by `PLUGIN-PRD` §1's boundary rule it cannot be a `PC`;
  `PLUGIN-PRD` §8 says the same from the other side ("any component that requires the server to do
  something `docs/MCP-PRD.md` does not specify … is a CAP in that document"). The open sub-question
  a triager owns: whether this is a **new `CAP`** or an **amendment to `D-07`**, which is already
  the cache decision and already three-way.
- **Depends on:** `CAP-01` — the only delivered capability, and what a cache would front. Nothing
  else blocks it: choosing in-process scope deliberately avoids `OQ-03`'s open refresh-trigger half,
  `PQ-03`, and the §6 Tag discovery pack that owns the persistence decision. **Not blocking but
  order-sensitive:** `OQ-02`'s answered-but-unimplemented page cap and `legalities` enum both change
  what a correct cache key contains, so landing them after a cache means revising the key.
- **Constrained by:**
  - **`D-03` — the sharp one.** No per-user state in module-level variables; config is read once at
    the entry point and passed down; handlers stay callable as plain functions in a test with no
    server started. The obvious implementation — a module-level `Map` — is forbidden by the
    decision that makes this codebase testable.
  - **§3.4** — 2/second on `/cards/search|named|random|collection`, 10/second elsewhere; a 429 locks
    access 30 seconds and sustained overage risks banning the application. Note the direction: a
    cache *reduces* request volume, so it is aligned with this constraint rather than in tension
    with it.
  - **`D-10`** — a cache miss, eviction, or corruption returns a structured failure. It never
    throws.
  - **`D-07`** — the existing three-way split this extends rather than replaces.
  - **§3.5** — if tag data is ever cached, track tags by `id` UUID; slugs are not stable
    identifiers.
- **Conflicts / prior art:** **Checked §8 of both PRDs 2026-08-10 — not rejected.** One adjacent
  rejection is the guardrail: `MCP-PRD` §8 rejects **"Reimplementing Scryfall's search engine
  locally,"** naming `D-07` as the reason that rejection exists. Caching responses is open; a cache
  that grows into local query evaluation is already out of scope. `PLUGIN-PRD` §8 inherits that list
  unchanged. Prior art that a triager must read first: **`D-07` is already the caching decision**
  (live `/cards/search` for query evaluation, live `/cards/collection` for known names at 75/batch,
  bulk files for corpora). **The batching half of "As stated" is already decided and was carved off
  this entry deliberately, not lost** — `MCP-PRD` §4.1.2 records `POST /cards/collection` at 75 per
  request as "the pricing primitive: a 100-card decklist is 2 requests, ~1 second. Any queued
  capability that prices a list should use this, never a loop over `/cards/named`", and
  `DEV-ROADMAP` §6 repeats it as a standing reminder for every future pack while the Decklist
  pricing pack is already specced against it. That half needs a capability to *use* it, not a new
  idea. Neither the Decklist pricing nor the Tag discovery pack is this. No other `IDEA-` entry
  existed when this was filed.
- **Opens:** *(pre-staged only — these get `OQ` numbers if and when this is triaged into a block)*
  - **What is the cache key?** It must carry every parameter that changes the result — normalized
    `q`, `unique`, `order`, `dir`, `page`, and the `legalities` enum once `OQ-02` ships. A key that
    omits one returns a confidently wrong result from cache, which is the same silent-wrong-answer
    class as Scryfall's dropped-invalid-term and `\A`-returns-zero traps.
  - **What TTL, given a cached search response embeds prices?** `D-07`'s own rationale already
    splits freshness — Scryfall's docs call bulk prices dangerously stale after 24 hours while
    gameplay data needs only weekly refresh — so a single uniform TTL over a payload containing both
    is wrong in one direction or the other.
  - **Is a capped response cacheable as though complete,** once `OQ-02`'s ~120-card page cap exists?
  - **Is a cache hit visible to the model,** or silent? A silent hit cannot be distinguished from
    fresh data when staleness matters.
- **Value:** Less waiting, fewer calls against a 2/second budget, and not paying twice in context
  for an answer already fetched.
- **Size, rough:** one slice
- **Next step:** Decide the cache key, TTL, and eviction bound at a desk — the `Opens` above are the
  agenda, and the TTL question is already half-answered by `D-07`'s freshness split. **Desk work: no
  harness, no live API, no third party.** Choosing in-process scope is what makes this settleable
  now rather than behind the persistence decision.
