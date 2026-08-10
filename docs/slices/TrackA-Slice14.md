# Track A — Slice 14: result trim and page cap (`OQ-02`'s two levers)

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Make a `card_search` result fit in a tool-result budget without discarding a card
anyone asked for. Today a well-formed query returning **111 cards — fewer than one page** —
produces a **116,626-character** result that exceeds the harness tool-result ceiling, and
`legalities` is **54.5%** of those bytes: every format on every card, for a question that named
one format. That is issue #25. This slice implements both levers
[OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) settled on 2026-08-07 — the
queried-format `legalities` trim and a server-enforced page cap — closes that question, and
delivers [CAP-01](../MCP-PRD.md#cap-01--card-search) criterion 13, which has been unimplemented
since it was added on 2026-08-04.

**The decision is made. This slice implements it and does not re-open it.** Both levers, their
rationale, and the alternatives already rejected are recorded in
[OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be); requirement 2 reproduces what
binds. What this document *does* decide is the mechanics
[OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) left to the implementing
slice: the cap's page size and paging arithmetic (requirement 7), and whether criterion 13 widens
or a fourteenth is added (requirement 13).

## Preconditions (deliverables of Slice 3)

Slice 14 depends on [Slice 3](./TrackA-Slice3.md) and nothing else — it edits the handler that
slice built:

- [`src/tools/card-search.ts`](../../src/tools/card-search.ts) with `toCardSummary`, the
  `CardSummary` / `CardSearchData` shapes, and the `has_more` / `note` pagination reporting.
- [`src/tools/register.ts`](../../src/tools/register.ts) with the tool description and the
  hand-written JSON Schema this slice adds a parameter to.
- `tests/tools/card-search.test.ts` and the `tests/fixtures/` layout.

[Slice 4](./TrackA-Slice4.md)'s price resolution and [Slice 6](./TrackA-Slice6.md)'s live
acceptance harness are both in place and both are touched only where the page size is hard-coded
(requirement 11). Track A being closed is what makes this a *repair* rather than a build: the
capability is delivered against criteria 1–12 and shipped inside a tagged `v0.1.0` MCPB bundle,
so the defect is in real installs today.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin and, since [PC-03](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab), as an
MCPB bundle for the Claude Desktop Chat tab. Track A is the server track: 1 (skeleton) · 2
(client) · 3 (handler) · 4 (prices) · 5 (wiring) · 6 (live pass) · **14 (this slice)**.

Two facts about the failure decide the shape of the fix, and both are easy to state backwards:

- **The query was not the problem.** Issue #25's call was
  `t:legendary t:creature id=rg is:commander f:commander` — tight, well-formed, and returning a
  *correct and useful* answer set. `total_cards: 111`, `has_more: false`. Pagination behaved
  exactly as [CAP-01](../MCP-PRD.md#cap-01--card-search) criterion 9 specifies. The limit that
  bit first was per-result **size**, not result **count**, and no amount of "narrow your query"
  instruction in [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s skill can reach it.
- **The recovery path does not exist on the surface that matters.** In Claude Code the model
  recovered by shelling out to `head` and `jq` against the spilled tool-result file. The Chat tab
  has no shell, so an oversized result there is simply unrecoverable — and the Chat tab is where
  the `v0.1.0` bundle installs. This is a server concern; nothing in `skills/` can fix it.

## Deliverables

| File | Action |
|---|---|
| [`src/tools/card-search.ts`](../../src/tools/card-search.ts) | modify — the trim, the cap, the paging arithmetic, the reported scope |
| [`src/tools/register.ts`](../../src/tools/register.ts) | modify — the `legalities` parameter, the schema, the description's page size |
| `dist/index.js` | rebuild and commit — [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript), enforced by CI |
| `tests/tools/card-search.test.ts` | modify — trim, cap, paging, and scope-reporting suites |
| `tests/fixtures/search-full-page.json` | new — one real 175-card page with all 23 legality keys |
| `scripts/cap01-live.mjs` | modify — the four hard-coded `175` assertions (requirement 11) |
| [`docs/MCP-PRD.md`](../MCP-PRD.md) | modify — [§5](../MCP-PRD.md#5-capabilities) field list + criterion 14 + delivery addendum; [§7](../MCP-PRD.md#7-open-questions) close [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be); one [§9](../MCP-PRD.md#9-revision-log) row; optionally one dated [§4.1.1](../MCP-PRD.md#411-search-endpoint) addendum |
| [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) | modify — [§4](../DEV-ROADMAP.md#4-phase-1-slices) table row and Track A entry; [§5](../DEV-ROADMAP.md#5-order-and-parallelism) graph edge |
| `docs/slices/TrackA-Slice14-results.md` | new — measured before/after bytes and the live confirmation |

No file under `skills/`, `.claude-plugin/`, `mcpb/`, or `.github/` changes.

## Requirements

1. **Both levers ship, or neither does.** They are independent and they multiply: the trim
   removes bytes nobody asked for, the cap bounds the count. Shipping only the trim leaves a
   full page at **88,953** characters against a ceiling that **116,626** already breached — the
   trim alone is *measured and refuted* as sufficient, which is the whole reason
   [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) grew a second lever. Do not
   land half of this and call issue #25 fixed.

2. **What [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) already decided,
   reproduced so you need not go read it.** Treat all four as given:
   - `legalities` is trimmed to the format the query names. When `q` names none, a small default
     set is used. The full map moves behind an opt-in.
   - The opt-in is an **enum**, not a boolean and not a `fields` list:
     `legalities: "queried" | "default" | "all"`, defaulting to `"queried"`. A boolean cannot
     express "queried"; a `fields` list is a general mechanism invented for one need.
   - The default set is the **seven paper constructed formats** (requirement 3).
   - The cap is server-enforced and **reports itself** through the existing `has_more` / `note`
     fields, so it is a stated boundary and never a silent truncation.

   `oracle_text` is **not** trimmed, at 17.3% of a full page. It is the field the model reasons
   from, and [§3.6](../MCP-PRD.md#36-error-surface)'s prohibition on claiming more than is known
   applies to card text as much as to errors. Do not add a second trim while you are in here.

3. **The default set is exactly these seven, and Scryfall returns 23 keys, not 21.** The full set
   as returned on a card object ([§4.1.1](../MCP-PRD.md#411-search-endpoint), verified
   2026-08-07): `standard`, `future`, `historic`, `timeless`, `gladiator`, `pioneer`, `modern`,
   `legacy`, `pauper`, `vintage`, `penny`, `commander`, `oathbreaker`, `standardbrawl`, `brawl`,
   `competitivebrawl`, `alchemy`, `paupercommander`, `duel`, `oldschool`, `premodern`, `predh`,
   `tlr`.

   The default set is `standard`, `pioneer`, `modern`, `legacy`, `vintage`, `commander`,
   `pauper`. Hard-code it as a named constant with a comment pointing at
   [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be), and **do not** derive it
   by subtracting a list of unwanted formats — a new format key appearing upstream must land
   outside the default, not silently inside it.

4. **Detecting the queried format is a scan for a hint, not a parse — and that distinction is
   load-bearing.** [CAP-01](../MCP-PRD.md#cap-01--card-search) states the capability "does not
   parse, validate, or reimplement the syntax," and [D-07](../MCP-PRD.md#d-07--three-way-cache-split)
   is why: Scryfall evaluates the query, this server does not. Nothing in this requirement
   changes that. The scan:
   - **never rejects a query**, never rewrites one, and never changes the bytes sent to Scryfall;
   - reads `q` only to choose which keys to *keep* in the response;
   - degrades to the default set on any miss, so a scan failure costs **bytes**, never
     correctness.

   Match, case-insensitively, the operators that name a format — `f:`, `format:`, `banned:`,
   `restricted:` — and collect every value. Rules:
   - A leading `-` (negation) still names a format: `-f:commander` means the user cares about
     commander legality. Match regardless.
   - Multiple formats union: `f:modern or f:legacy` keeps both keys.
   - **Verify the operator list live before trusting it** (requirement 17). `legal:` may be a
     synonym for `f:`; confirm rather than assume, and confirm with single spaced calls
     ([§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)). An operator you
     omit costs the default set, which is safe — an operator you *invent* costs nothing here
     because you are reading, not emitting, but do not record an unverified one in the PRD.
   - A format **alias** is the sharp edge: Scryfall accepts values that are not legality keys
     (`f:edh` for `commander` is the known one). A scanned token that is not one of the 23 keys
     is a **miss**, not an empty result.
   - A false positive from a quoted string (`o:"f:commander"`) keeps one extra key. Acceptable.
     Do not build a tokenizer to prevent it.

5. **The trim never produces an empty `legalities` map. This is the requirement that keeps a
   lookup miss from becoming a silent wrong answer.** If the scan finds no format, or finds only
   tokens that map to no legality key, fall back to the seven-format default set. An empty map
   would read to the model as "this card has no legalities," which is the same class of failure
   as [§4.1.1](../MCP-PRD.md#411-search-endpoint)'s `\A` trap — a normal-looking 200 carrying a
   wrong answer. Assert it in a test with a deliberately bogus format
   (`f:notaformat`, `f:edh`).

6. **Report the scope, once per response, because an absent key must never read as "not legal".**
   [§3.6](../MCP-PRD.md#36-error-surface) forbids claiming more than is known, and a trimmed map
   is exactly a case where silence could be misread as a fact. Add two top-level fields to
   `CardSearchData` — not per card:

   ```
   legalities_mode: "queried" | "default" | "all"
   legalities_included: string[]      // the keys present on every card in `cards`
   ```

   Cost is roughly 100 characters once, against 84,226 saved. Always emit both, including under
   `"all"`, so the model never has to handle two response shapes. Say plainly in the tool
   description that formats outside `legalities_included` were **not returned** and are not
   claims about legality.

7. **The cap is 88 cards — exactly half a Scryfall page — and `page` becomes *our* page.** This
   is the mechanic [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) left open,
   and the naive reading of "near 120" is a trap: Scryfall's `page` parameter is in units of
   **175** and the endpoint has no offset, so a 120-card cap over a 175-card page leaves cards
   121–175 reachable by **no `page` value at all** — a silent loss strictly worse than the
   payload problem it was meant to fix. Splitting a Scryfall page in half is what makes every
   card reachable at one upstream request per call:

   ```
   PAGE_SIZE = 88

   upstreamPage = Math.floor((page - 1) / 2) + 1
   offset       = ((page - 1) % 2) * 88
   cards        = upstream.data.slice(offset, offset + PAGE_SIZE)
   ```

   Our page 1 → upstream page 1, cards 0–87. Our page 2 → upstream page 1, cards 88–174 (87 of
   them; the halves are 88 and 87, and that unevenness is fine). Our page 3 → upstream page 2,
   cards 0–87. **Never more than one upstream request per call**, which is why this shape was
   chosen over a 120-card sliding window: the window straddles upstream pages and would cost two
   requests on most calls, doubling load on the endpoint
   [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) caps at 2/second.

   88 cards at the 508 chars/card measured under the queried trim is roughly **44,700
   characters** — deliberately below
   [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be)'s ~61,000 estimate, because
   per-card cost varies by at least 8% with the cards a query returns (969 chars/card on the
   measured full page against issue #25's 1,050) and the ceiling itself is known only as an upper
   bound.

8. **`has_more` is ours to compute, and it is not upstream's.** A response is capped whenever
   cards remain in the fetched upstream page:

   ```
   has_more = (offset + PAGE_SIZE < upstream.data.length) || upstream.has_more
   ```

   The first disjunct is the one that is easy to miss and the one issue #25 would have tripped:
   111 cards, `has_more: false` from Scryfall, and yet our page 1 stops at 88 with 23 more
   sitting in a page we already hold. `total_cards` passes through **unchanged** — it is
   Scryfall's true total and trimming a page does not change how many cards match.

9. **The `note` reports the boundary in *our* page units, and the page count is not
   `ceil(total_cards / 88)`.** Our paging is anchored to upstream pages of 175, so:

   ```
   U          = ceil(total_cards / 175)          // upstream pages
   lastLen    = total_cards - (U - 1) * 175      // cards on the last upstream page
   ourPages   = (U - 1) * 2 + (lastLen > 88 ? 2 : 1)
   ```

   For `total_cards: 176` that is **3** pages, where `ceil(176 / 88)` says 2 — our page 2 holds
   87 cards and our page 3 holds 1. Quoting the naive figure would tell the model a page does not
   exist when it does. Test this case explicitly. The note should name the total, the range shown,
   and the page count, e.g. `1,197 cards match; showing cards 1–88 (page 1 of 14). Narrow the
   query or request a specific page.`

10. **A page past the end is not "no cards match".** Requesting our page 2 of a 50-card result
    slices to an empty array. Zero matches is already a distinct, meaningful outcome — Scryfall
    answers it with an HTTP 404 that [Slice 3](./TrackA-Slice3.md) deliberately maps to a
    successful empty result — so an out-of-range page must say *that* instead, naming the valid
    range. Do not let the two collapse into one indistinguishable empty response.

11. **Every hard-coded `175` outside the client is now wrong. Find them all.** Known sites:
    - [`src/tools/register.ts`](../../src/tools/register.ts): the description's
      "175 cards per page" and the `page` property's "1-based page; 175 cards per page."
    - `scripts/cap01-live.mjs`: four assertions at roughly lines 248–271 asserting
      `data.cards.length <= 175`. These are [CAP-01](../MCP-PRD.md#cap-01--card-search) criterion
      9's live checks; they must assert `<= 88` and still assert `total_cards > 175`, which is
      about the *query* matching more than one upstream page and stays correct as written.
    - Grep for the literal before you finish: `git grep -n 175 -- src/ scripts/ tests/`.

12. **The tool description must earn its bytes.** It gains the `legalities` parameter, the new
    page size, and the scope caveat from requirement 6, and it is resident context on every
    surface. Keep the additions to the shortest form that states the behavior. Note the standing
    finding this sits against:
    [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) was answered
    by [Slice 9](./TrackB-Slice9.md) with the compact-description split holding, and that argues
    for a *shorter* skill body and a stable description — not for expanding either. Do not take
    this edit as licence to grow the description generally.

13. **Criterion 13 stays as written and a criterion 14 is added.**
    [CAP-01](../MCP-PRD.md#cap-01--card-search)'s 2026-08-07 delivery-note addendum explicitly
    leaves this choice to "the slice that implements the trim," and this is that slice. Two levers
    decided three days apart, with different failure modes, get two independently falsifiable
    criteria; widening 13 to cover the cap would make one criterion that can half-pass. Criterion
    13's text already covers all three enum states and needs no edit. Add:

    ```
    14. **A page reports at most 88 cards, and every matching card is reachable by some page.**
        Added <date> with OQ-02's page cap. A query matching more than 88 cards returns 88 with
        `has_more: true` — including when Scryfall itself reports `has_more: false`, the case
        issue #25 hit at 111 cards. Card 89 of that result appears on page 2, and no card is
        reachable by no page: page size 88 is exactly half Scryfall's 175, so both halves of every
        upstream page are addressable.
    ```

14. **Close [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) in the same
    session — this is a deliverable, not follow-up.**
    [§7](../MCP-PRD.md#7-open-questions) questions are never deleted; they gain a dated paragraph,
    the way that block's own "**Completed 2026-08-07**" paragraph does. Its final paragraph
    currently reads "**Nothing is implemented.**" and names issue #25 as open — append an answer
    that names the mechanism, the measured before/after bytes, the page size actually chosen and
    **why it is 88 rather than the 120 the decision estimated** (requirement 7's reachability
    argument), and the evidence file. Then append **one** row to
    [§9](../MCP-PRD.md#9-revision-log), which is append-only.

    Do **not** mint a new `D-` decision. [§2](../MCP-PRD.md#2-locked-decisions) is locked and this
    is an implementation of an existing answer, not a new decision.

15. **Update [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) — status only; the entries already
    exist.** Scoping on 2026-08-10 added the
    [§4](../DEV-ROADMAP.md#4-phase-1-slices) table row, the Track A entry, the
    `S3 --> S14 --> S12` edge and the dated sequencing paragraph in
    [§5](../DEV-ROADMAP.md#5-order-and-parallelism). This slice flips ☐ to ☑ with the PR number,
    ticks the three **Done when** boxes, and records that
    [§2](../DEV-ROADMAP.md#2-current-state-verified-2026-08-04)'s standing line about "the slice
    that implements [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be)'s trim and
    page cap" is discharged. The roadmap owns sequencing only; if it and the PRD ever disagree, the
    PRD wins.

16. **Rebuild and commit `dist/index.js` in the same commit as the `src/` change.**
    [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript): the committed bundle
    is what the plugin starts, and a stale one produces a plugin whose tools are simply *absent*
    with no error. [Slice 11](./TrackC-Slice11.md)'s CI gate will fail the PR otherwise — it
    reports the omission, it does not repair it.

17. **One live confirmation, and only one.** Re-run issue #25's exact query —
    `t:legendary t:creature id=rg is:commander f:commander`, `order: edhrec` — against real
    Scryfall through the built server, and record the response's character count beside the
    116,626 that failed. That is the "confirm the shaped page against a real harness rather than a
    local measurement" half of
    [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be)'s stated resolution.
    Everything else is a unit test against a fixture.
    [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) binds: card endpoints
    are 2/second, calls stay ≥600 ms apart, and **never provoke a 429 to see what happens** — a
    429 locks access for 30 seconds and sustained overage risks banning the application for every
    user of it.

## Interface contracts

The shaped response after this slice. Changed and new fields marked:

```
{
  cards: CardSummary[],                            // <= 88          (changed: was <= 175)
  total_cards: number,                             // Scryfall's true total, unchanged
  page: number,                                    // OUR page, 1-based, 88/page (changed)
  has_more: boolean,                               // ours, not upstream's       (changed)
  legalities_mode: "queried" | "default" | "all",  // new
  legalities_included: string[],                   // new
  note?: string
}
```

`CardSummary.legalities` keeps its `Record<string, string>` type; only its key set narrows.
Every other field of `CardSummary` — name, mana cost, cmc, type line, oracle text, colors, color
identity, power/toughness/loyalty, rarity, set, set name, and `price` — is untouched. The three
price traps of [§4.1.3](../MCP-PRD.md#413-price-fields--three-verified-traps) and
`resolvePrice` are not in scope.

The tool's input schema gains exactly one property:

```
legalities: { type: "string", enum: ["queried", "default", "all"] }   // default "queried"
```

`q`, `unique`, `order`, `dir`, `page` are unchanged in name and type; only `page`'s *description*
changes, because its unit did. `dispatchToolCall`'s existing discipline holds — validation stays
minimal, a wrong-typed `legalities` is silently dropped and falls back to `"queried"` rather than
erroring, and handlers still never throw
([D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw)).

Data flow is unchanged: `cardSearch` → `client.get` → shape. The trim and the cap both live in
[`src/tools/card-search.ts`](../../src/tools/card-search.ts), below the entry point and above the
client, so both stay testable by passing a fake client
([D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions)). Nothing reads
`process.env`.

## Out of scope — do NOT

- **No `oracle_text` trim, truncation, or summarization** — requirement 2. It is 17.3% of a page
  and it is the field the model reasons from.
- **No EUR price fallback.** [OQ-09](../MCP-PRD.md#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists)
  was answered 2026-08-07 (USD-only stands, a distinct `no-usd-price` reason carries the EUR
  figure) and is *also* unimplemented. It is a different unimplemented decision in the same file;
  do not fold it in.
- **No `fields` parameter, no `verbose` boolean.** Both were considered and rejected by name in
  [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be). The enum is the answer.
- **No client-side query parsing, validation, or rewriting** — requirement 4. The scan reads `q`
  and never alters what is sent.
- **No auto-paging.** The cap makes pages smaller; it must not make the server fetch more of them.
  One upstream request per call, always.
- **No caching, no bulk data, no persistence.** [OQ-03](../MCP-PRD.md#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced)
  owns that and the tag-discovery pack introduces it.
- **No edits under `skills/`.** This is a server concern by construction — the issue says so, and
  a skill cannot fix a result shape. Any temptation to teach the model about the cap belongs in
  the tool description (requirement 12), which travels with the server on every surface.
- **No new npm dependencies**, dev or runtime, and no change to whether the SDK stays a
  devDependency.
- **No edits to [§2](../MCP-PRD.md#2-locked-decisions) or
  [§3](../MCP-PRD.md#3-constraints) of either PRD**, and no rewriting of
  [§4](../MCP-PRD.md#4-external-dependencies) — a new measurement is *appended* as a dated
  addendum the way [§4.1.1](../MCP-PRD.md#411-search-endpoint)'s existing ones are, never written
  over an old figure.
- **No `.mcpb` release and no tag.** `v0.1.0` is spent and `claude plugin tag` writes into the
  same `v*` namespace `release.yml` watches, so an accidental tag cuts a second bundle release.
  Shipping this fix to the Chat tab is a separate, deliberate act — and a released bundle cannot
  be withdrawn.

## Acceptance criteria

1. `card_search` accepts `legalities: "queried" | "default" | "all"` and defaults to `"queried"`
   when the parameter is absent, wrong-typed, or not one of the three.
2. **[[CAP-01](../MCP-PRD.md#cap-01--card-search) criterion 13]** `f:commander` returns commander
   legality and no other key; a query naming no format returns exactly the seven default keys;
   `legalities: "all"` returns all 23. Checked against a multi-card response, not one card.
3. **[requirement 5]** `f:notaformat` and `f:edh` each return the seven-key default set — never
   an empty map.
4. **[[CAP-01](../MCP-PRD.md#cap-01--card-search) criterion 14]** A 111-card result returns 88
   cards with `has_more: true` while `total_cards` reads 111, and page 2 of that result returns
   the remaining 23. This is issue #25's exact shape and the case upstream `has_more: false`
   would hide.
5. A 175-card upstream page yields 88 cards on our page 1 and 87 on our page 2, both from **one**
   upstream request each — asserted by counting calls on the fake client.
6. `total_cards: 176` reports **3** pages in the note, not 2.
7. Requesting a page past the end returns a response distinguishable from a zero-match result,
   naming the valid page range.
8. `legalities_mode` and `legalities_included` are present on every successful response including
   under `"all"`, and `legalities_included` matches the keys actually present on the cards.
9. **[Roadmap done-when]** Issue #25's exact query, run live through the built server, returns a
   response whose character count is recorded beside 116,626 — and it is under the ceiling that
   response breached.
10. `git grep -n 175 -- src/ scripts/` returns no page-size assertion or description; the live
    harness asserts `<= 88`.
11. `npm test` passes with the new suites, and `npm run typecheck` is clean under
    `exactOptionalPropertyTypes` — the two new fields are required, not optional, so no
    conditional spread is needed for them.
12. `npm run build` leaves `git status --porcelain -- dist/` empty, and the rebuilt bundle is in
    the same commit as the `src/` change.
13. [`docs/MCP-PRD.md`](../MCP-PRD.md) shows: the
    [§5](../MCP-PRD.md#5-capabilities) field-list edit, criterion 14 appended, a dated
    delivery-note addendum stating
    [CAP-01](../MCP-PRD.md#cap-01--card-search) is delivered against 1–14, a dated answer closing
    [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) in
    [§7](../MCP-PRD.md#7-open-questions), and exactly one new
    [§9](../MCP-PRD.md#9-revision-log) row. No new `D-` decision;
    [§2](../MCP-PRD.md#2-locked-decisions)/[§3](../MCP-PRD.md#3-constraints) untouched.
14. `npm run lint:docs` passes — every link and anchor added by this slice resolves.
15. `docs/slices/TrackA-Slice14-results.md` records: date, before/after character counts for both
    the 111-card and full-page cases, the live run from criterion 9, the chosen page size with its
    reachability rationale, and the test counts.

## Testing requirements

Unit tests carry everything except criterion 9. `tests/tools/card-search.test.ts` already calls
the handler as a plain function against a fake client
([D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions)); extend that
pattern rather than starting a server.

The existing `tests/fixtures/search-page-1.json` is **3 cards with 8 legality keys** and cannot
test either lever. Capture `tests/fixtures/search-full-page.json` — one real 175-card page with
the full 23-key `legalities` — with a single live call, and load it with `readFileSync` rather
than importing JSON, so it behaves identically under type stripping and under the bundle. One
fixture serves the cap tests, the trim tests, and the byte measurement.

Suites to add:

- **Trim** — each enum value; the queried/default/all key sets; negation (`-f:modern`); union
  (`f:modern or f:legacy`); case (`F:Commander`); the bogus-format and alias fallbacks
  (criterion 3).
- **Cap and paging** — the 88/87 split; upstream-request counting (criterion 5); issue #25's
  111-card shape (criterion 4); the 176-card page count (criterion 6); the past-the-end page
  (criterion 7).
- **Scope reporting** — presence and accuracy of both new fields under all three modes.
- **Byte measurement** — shape the full-page fixture and assert the result is materially smaller
  than 169,504 characters. Assert a *bound*, not an exact number: per-card cost varies with the
  cards a query returns, and an exact-equality assertion here becomes a test that fails on a
  fixture refresh for no real reason.

`npm run acceptance` is the live harness and stays a deliberate, human-run, local step. Run it
**once** after the change to confirm the amended assertions still pass. Do not wire it into CI
under any trigger — [Slice 6](./TrackA-Slice6.md) and
[Slice 11](./TrackC-Slice11.md) both already refuse this, and
[§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) is why.

## Verification steps

```bash
# 1) unit level — the levers, in isolation
npm test                       # new suites green; record suite/test counts for the results doc
npm run typecheck              # exactOptionalPropertyTypes is strict about the new fields

# 2) the page-size sweep — no stale 175 anywhere it means "page size"
git grep -n 175 -- src/ scripts/ tests/

# 3) build honesty — Slice 11's gate, run before CI runs it for you
npm run build
git status --porcelain -- dist/          # must print nothing

# 4) docs
npm run lint:docs                        # every new link and anchor resolves

# 5) live, deliberate, spaced — the acceptance harness and the one issue #25 rerun
npm run acceptance                       # >=600 ms between calls; must not provoke a 429
#    then issue #25's query through the built server; record the character count

# 6) pre-push
claude plugin validate . --strict
```

## References

- **Issue #25** — the failing call, the per-field byte table, the 1,051 chars/card average, and
  the "no shell on the Chat tab" argument this slice's urgency rests on.
- [`docs/MCP-PRD.md`](../MCP-PRD.md)
  [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) — the decision in full:
  the 2026-08-04 answer and its rejected alternatives, the 2026-08-07 completion with the seven
  default formats and the enum, and the paragraph adding the cap. Read the "Why this and not the
  alternatives" paragraph before proposing any change to the shape.
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [§4.1.1](../MCP-PRD.md#411-search-endpoint) — the full-page
  measurement (169,504 chars; 84,226 of it `legalities`; 109,059 and 88,953 under the two trims)
  and the 23-legality-key addendum. Both dated 2026-08-07 and both append-only.
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [CAP-01](../MCP-PRD.md#cap-01--card-search) — the field list
  this slice edits, criterion 13 as written, criterion 9 (pagination, which stays true), and the
  2026-08-07 delivery-note addendum that hands the criterion-13-or-14 choice to this slice.
- [`docs/MCP-PRD.md`](../MCP-PRD.md)
  [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) (rate limits are hard
  constraints), [§3.6](../MCP-PRD.md#36-error-surface) (never claim more than is known — why
  requirement 6 exists), [D-07](../MCP-PRD.md#d-07--three-way-cache-split) (Scryfall evaluates the
  query, not this server), [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw) (handlers never
  throw).
- [`docs/slices/TrackA-Slice3.md`](./TrackA-Slice3.md) — the handler this slice edits, including
  the deliberate 404-as-empty mapping requirement 10 must not collide with, and the note that
  `legalities` passing through untrimmed was "a deliberate deferral rather than a decision."
- [`docs/slices/TrackA-Slice6.md`](./TrackA-Slice6.md) — the live acceptance harness whose page
  assertions requirement 11 amends, and its standing refusal to CI-wire live calls.
- [`docs/slices/TrackC-Slice11.md`](./TrackC-Slice11.md) — the CI gate that will fail this PR if
  `dist/` is not rebuilt, and why absent-`dist/` is the failure that matters.
- `CLAUDE.md`, "Price handling" (untouched here, and why) and "Editing the docs" (the anchor and
  link rules requirement 14's `npm run lint:docs` enforces).
