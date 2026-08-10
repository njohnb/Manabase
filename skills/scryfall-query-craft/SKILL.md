---
name: scryfall-query-craft
description: "Turn a plain-English Magic: The Gathering card request — cheap green ramp legal in my commander deck, creatures that make a token when they die, cards with squirrel art, budget removal under a dollar — into one precise card search, and read the results back accurately."
when_to_use: "Use whenever someone wants Magic cards matching conditions rather than naming one card they already know: deckbuilding for commander/EDH, standard, modern, pauper or any format; filtering by color, color identity, mana value, card type, keyword, power/toughness, rarity, set, or a price ceiling; finding cards by what they do or by a pattern in their rules text; artwork requests; checking what a card is allowed in. Also use when a card search came back empty, far too broad, or with an error."
---

# Writing card searches

The Manabase card search tool sends `q` to Scryfall verbatim. Your job is to compress the whole
request into that one string, then read the result correctly.

**Every card fact you state comes from that tool.** Never answer from memory, from a web search,
or from a Scryfall web page — not which cards exist, not card text, not prices, not legality. If
that tool is not among the tools available to you, say so plainly and stop; do not substitute
another source. A silent substitution looks like an answer and is not one.

## Procedure

1. **Extract the constraints the request actually contains**: color or identity, type, mana
   value, format, price, behavior, text pattern, artwork, set, rarity.
2. **Map each constraint to exactly one operator.** If you cannot name an operator you have seen
   work, read `reference/operators.md` before guessing.
3. **Combine them into ONE query.** Terms are implicitly ANDed. Every constraint the user stated
   belongs inside `q` — never search broadly and filter the results yourself. One precise call
   beats three vague ones.
4. **Set `unique` / `order` / `dir` deliberately** (below), then call the tool **once**.
5. **Read `total_cards` before `cards`** — it is the true total; at most 88 come back per page.
6. **Narrow or refine** from what you see, and answer from the returned fields, not from memory.

## The operators most requests need

| Need | Operator |
|---|---|
| card type | `t:creature`, `t:land`, `t:instant` |
| color / color identity | `c:g`, `c:wu`; `id:golgari` — identity is the commander-deck one |
| mana value | `cmc<=2`, `mv=0`, `mv>=7` (`mv` and `cmc` are the same field) |
| card text | `o:"draw a card"`; regex `o:/^{T}: Add/` when the request is a *pattern* |
| what a card does | `otag:ramp`, `function:removal` — community tags, not card text |
| artwork | `art:squirrel`, `atag:squirrel` |
| format | `f:commander`, `f:pauper`; `banned:modern`; `restricted:vintage` |
| price ceiling | `usd<=1`, `usd>=50` |
| rarity / set | `r:mythic`, `r!=common`, `set:dom` |
| power / toughness | `pow>=5`, `tou<=1` |
| keyword | `kw:deathtouch` |
| paper vs digital | `game:paper` |
| exact name | `!"<CARDNAME>"` — the leading `!` is what makes it exact; `name:` is a substring |
| exclude | leading `-`: `-t:land`, `-is:reprint`; or `not:reprint` |
| either/or | `(c:g or c:b)` — parentheses group, and `or` must be written out |

Comparisons `=`, `!=`, `<`, `<=`, `>`, `>=` work on `cmc`/`mv`, `usd`, `pow`, `tou`, `r`.

**For anything not in this table, read `reference/operators.md` before you
write the query.** For more English→query translations and a table of Scryfall error text mapped
to the fix it implies, read `reference/recipes.md`.

## Worked examples

- *"cheap green ramp for my commander deck"* → `q: "id:g otag:ramp f:commander cmc<=2"`,
  `order: "cmc"`
- *"budget removal under a dollar in modern"* → `q: "function:removal f:modern usd<=1"`,
  `order: "usd"`
- *"cards whose text starts with a tap ability that adds mana"* → `q: "o:/^{T}: Add/"` — an
  anchored pattern plain `o:` cannot express.

## unique, order, dir

- `unique` defaults to `cards` — one row per card, the deckbuilding default; keep it. Use
  `"prints"` only for questions about a *specific printing*; `art` rolls up by illustration.
- `order` decides *which* 88 cards you see first, so on a broad query it decides the whole
  answer. Match it to the request; the values are in `reference/operators.md`.
- `dir`: `auto` | `asc` | `desc`. `auto` is Scryfall's per-field default.

## Narrow, don't page

The tool reports pagination (`total_cards`, `has_more`, a `note` when more pages exist) and never
resolves it. A large `total_cards` means the query is too loose — add a constraint, do not ask for
`page: 2`. Page only when the user genuinely asked for something large and `q` is already as tight
as the request allows.

## When it goes wrong

**Zero matches is a success, not an error.** A valid query that matches nothing returns
`cards: []`, `total_cards: 0`, and a `note`. *Loosen the query* — drop or widen a constraint and
call again. Never apologise and never report the tool as broken.

**On an error result**, `details` carries Scryfall's own words verbatim. Read it, fix the term it
names, and call again. Bound the loop: two or three revisions, then tell the user what you tried
and what Scryfall said.

**A wrong operator does not reliably announce itself.** "All of your terms were ignored." appears
only when *every* term is invalid. One bogus term among valid ones is **silently dropped**,
returning an ordinary result computed from fewer constraints than the user asked for. So:

- **Never emit an operator you have not seen work.** One that *feels* like it should exist is the
  likeliest to be wrong, and a guess costs a real request.
- A suspiciously broad result may be a dropped term — re-check `q` against the table above.
- **`illustrationtag:` is not real.** It patterns exactly like `otag:` and `atag:` and does not
  exist. Artwork: `art:` / `atag:`. What a card does: `otag:` / `function:`.

## Reading the result

Optional card fields (`mana_cost`, `oracle_text`, `colors`, `power`, `toughness`, `loyalty`) are
**absent** when a card lacks them, never null. Two-faced and split cards join their faces with
`" // "`. Answer from the returned fields, not from memory.

`price` is `{"available": true, "usd": "…", "finish": …}` or
`{"available": false, "reason": "digital-only"|"no-price-data"}`. Prices are strings; report a
missing price as missing, never as zero. `digital-only` means a digital printing won the rollup —
add `game:paper` if the user wants paper prices. It is not the same as no price data.
