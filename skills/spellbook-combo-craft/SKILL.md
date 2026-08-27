---
name: spellbook-combo-craft
description: "Turn a plain-English Magic: The Gathering combo request — what can I do with Thassa's Oracle, infinite mana combos in Temur, cheap two-card wincons, combos that make infinite tokens — into one precise Commander Spellbook combo search, and read the results back accurately."
when_to_use: "Use whenever someone wants combos rather than single cards: what combos a card enables or is part of, infinite-anything combos, two- or three-card wincons, combos that produce a given result, or combos inside a color identity or commander. Also use to decide between combo search and card search — combos come from here, card facts (text, prices, legality of one card) come from card search. And use when a combo search came back empty, far too broad, errored, or needs another page."
---

# Writing combo searches

The Manabase combo search tool sends `q` to Commander Spellbook verbatim. Your job is to compress
the combo request into that one string, page it without flooding context, and read the result
correctly.

**Every combo fact you state comes from that tool.** Never answer from memory, from a web search,
or from the Commander Spellbook site — not which combos exist, not their pieces, not what they
produce, not their steps. If the combo search tool is not among the tools available to you, say so
plainly and stop; do not substitute another source.

## Which tool: combo search vs card search

Two different questions take two different tools. Pick before you write a query.

| The request is about… | Tool | Example |
|---|---|---|
| **Combos** — what a card enables, infinite loops, wincons, what pieces go together | **combo search** (this skill) | "what can I do with Kiki-Jiki?" |
| **Cards** — finding cards by color/type/cost/text, prices, one card's legality | **card search** (`scryfall-query-craft`) | "cheap red creatures under $1" |

They compose. A combo result lists each piece's `name` and `oracle_id`; to price those pieces, or
read their oracle text, run a **card search** on them (`oracle_id` joins back to Scryfall via
`oracleid:`). Combo search never returns prices — `D-06` makes Scryfall the price source.

## Procedure

1. **Decide it is a combo question** (table above). If it is really "find me cards", stop and use
   card search instead.
2. **Extract the combo constraints**: a specific card, number of pieces, what it produces, color
   identity, commander, step count.
3. **Map each to one Commander Spellbook operator.** The everyday ones are below; the full set is
   in `reference/combo-operators.md`. Combos involving one card is the common case and is just
   `card:"…"`.
4. **Combine into ONE query** — terms are implicitly ANDed — then call the tool **once**.
5. **Read `total_combos` before `combos`** — it is the true total; one page carries only as many
   combos as fit a byte budget.
6. **Page by `next_offset` or narrow** (see below), and answer from the returned fields.

## The operators most combo requests need

| Need | Operator |
|---|---|
| combos involving a card | `card:"Thassa's Oracle"` — the common case; quote names with spaces |
| how many pieces | `cards<=2`, `cards>2 cards<=4` (comparisons on the count) |
| what it produces | `result:"infinite mana"`, `result:"win the game"` |
| color identity | `ci:temur`, `ci:bg`, `ci<=wu` — the commander-deck identity |
| built around a commander | `commander:"Kenrith, the Returned King"` |
| few steps / few prerequisites | `steps<=2`, `pre<=1` — for simple, low-setup combos |
| how popular | `pop>1000` (`popularity`, in decks) |
| exclude | leading `-`: `-card:"Demonic Consultation"` |
| either/or | `(ci:temur OR ci:jeskai)` — `OR` written out, parentheses group |

Comparisons `:`, `=`, `<`, `<=`, `>`, `>=` work on the counted fields (`cards`, `steps`, `pre`,
`results`, `pop`, `ci`, `mv`).

**For anything not in this table, read `reference/combo-operators.md` before you write the query.**
It carries the full operator set and a table of error text mapped to the fix.

## Worked examples

- *"what combos is Thassa's Oracle part of?"* → `q: "card:\"Thassa's Oracle\""`
- *"cheap two-card infinite mana combos in Temur"* → `q: "cards<=2 result:\"infinite mana\" ci:temur"`
- *"simple wincons for my Kenrith deck"* → `q: "commander:\"Kenrith, the Returned King\" result:\"win the game\" steps<=2"`

## Page by next_offset — don't flood context

One tool call makes **one** upstream request and returns **one page**. A page is filled to a **byte
budget**, not a fixed combo count, so *how many combos a page holds varies with how big the combos
are* — a page of two-card combos is longer than a page of ten-card ones.

- **Read `total_combos` first.** It is the true total across all pages.
- **To get the next page, pass the response's `next_offset` back as `offset`.** Never compute an
  offset yourself — because page size varies, a guessed offset silently skips or repeats combos.
  `next_offset` is **absent on the last page**.
- **A huge `total_combos` means the query is too loose — narrow it, don't walk every page.** Add
  `cards<=3`, a `result:"…"`, a `ci:`, or `steps<=2`. One tight query beats paging through
  hundreds of combos into context. Page through only when the user genuinely asked for the whole
  list.

## format and legality

`format` is a **parameter**, not part of `q`. It names the one format the returned `legal` boolean
is judged for; it **defaults to `commander`**.

- The valid names are Commander Spellbook's **16**, and they are **not** Scryfall's. An unknown
  `format` is **refused** (not guessed), and the refusal lists the valid names — pick one. Note
  `standardBrawl` differs from Scryfall's spelling only in case, and `edh` is accepted as an alias
  for `commander`.
- Each combo carries `legal: true|false` **for that one format only** — never a map. An absent
  legality is reported as an error, never as `false`.
- To *filter* to combos legal in a format (rather than just labelling them), put `legal:commander`
  in `q`. See the reference.

## When it goes wrong

Commander Spellbook is the **opposite** of Scryfall here, and it is the safe direction: a bad
operator fails **loudly**, so a reasonable guess is correctable rather than silently wrong.

- **An unrecognized operator returns an error naming the exact character position.** `details`
  carries Commander Spellbook's own words. Read it, fix that character, call again. Bound the loop:
  two or three revisions, then tell the user what you tried and what it said.
- **Zero matches is a success, not an error.** A valid query that matches nothing returns
  `combos: []`, `total_combos: 0`, and a `note`. *Loosen* — drop or widen the narrowest constraint.
  Never apologise or report the tool as broken.
- **An `offset` past the end** returns a `bad_request` naming the valid range — start at `offset: 0`
  and follow `next_offset`. This is distinct from zero matches (`total_combos` is non-zero here).

## Reading the result

Each combo carries: `uses` (its cards, each with `name`, `oracle_id`, `quantity`, `zones`,
`must_be_commander`), optional `requires` (template pieces like "any creature"), `produces` (what
it does), `color_identity`, `mana_needed`, `mana_value_needed`, optional `prerequisites`,
`description` (the step-by-step line), `bracket_tag`, optional `popularity`, and `legal`. Optional
fields are **absent** when empty, never null. Answer from these fields, not from memory. No price
and no image is ever returned — reach for card search when the user wants either.
