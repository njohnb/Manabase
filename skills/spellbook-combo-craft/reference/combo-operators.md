# Commander Spellbook query operators

The full search syntax, evaluated by Commander Spellbook itself. It **validates loudly**: an
unrecognized operator returns an error naming the offending character's position, so a wrong guess
fails safe and is correctable from `details` — unlike Scryfall, which silently drops a bad term.
Prefer an operator you have seen work; when unsure, one call tells you.

## Cards in the combo

| Need | Operator | Example |
|---|---|---|
| a card by name (substring) | `card:` (alias `cards`) | `card:"breath of"` |
| a card by exact name | `card=` | `card=sydri` |
| every listed card must match | `all-card:` or `@card:` | `all-card:dragon` |
| number of cards in the combo | `cards` `< <= = > >=` | `cards>2 cards<=5` |
| a piece's type | `type:` (aliases `cardtype`, `t`) | `type:land` |
| a piece's oracle text | `oracle:` (aliases `text`, `o`) | `oracle:draw` |
| a piece's keyword | `keyword:` (alias `kw`) | `keyword:indestructible` |
| a piece's mana value | `mv` (aliases `manavalue`, `cmc`) | `mv=0` |
| a piece's color | `cardcolor:` | `cardcolor:gw` |

## The combo as a whole

| Need | Operator | Example |
|---|---|---|
| color identity | `ci` (aliases `coloridentity`, `id`, `color`) | `ci:temur`, `ci<=wu` |
| what it produces | `result:` (alias `results`) | `result:"infinite mana"` |
| number of results | `results` `< <= = > >=` | `results>1` |
| prerequisites (count or text) | `pre` (aliases `prerequisites`, `prerequisite`) | `pre<=3` |
| number of steps | `steps` (aliases `step`, `description`) | `steps>6`, `steps<=2` |
| template pieces (e.g. "any creature") | `template:` | `template:creature` |
| commander it is built around | `commander:` | `commander:derevi` |
| popularity (decks running it) | `pop` (aliases `popularity`, `decks`) | `pop>1000` |
| price of the pieces | `price` (aliases `usd`, `eur`, `tcgplayer`) | `price<5` |
| bracket | `bracket:` | `bracket:ruthless` |
| tags | `is:` | `is:featured`, `is:commander`, `is:reserved`, `is:preview` |
| a specific combo id | `sid:` (alias `spellbookid`) | `sid:4131-4684` |

Comparison operators `:`, `=`, `<`, `<=`, `>`, `>=` work on every counted or numeric field above.

## Combining terms

- **AND is implicit** — space-separated terms all apply: `cards<=2 ci:temur result:infinite`.
- **OR** is written out (also `||`), with parentheses to group: `(ci:temur OR ci:jeskai)`.
- **Negate** with a leading `-`, on a term or a group: `-card:brudiclad`, `-(is:lock OR is:mld)`.
- **Quote** phrases with spaces or punctuation: `card:"Goblin King"`. Escape an internal quote with
  a backslash. Capitalization and diacritics are ignored.

## Legality

`legal:` (alias `format:`) filters combos to those legal in a format, and `banned:format` is its
negation: `legal:modern`, `banned:commander`. This is different from the tool's **`format`
parameter**, which only sets which format the returned `legal` boolean reflects (default
`commander`) — the parameter labels, the `legal:` operator filters. Both use Commander Spellbook's
16 format names, which are **not** Scryfall's: `standardBrawl` differs only in case, `edh` is an
alias for `commander`, and Scryfall-only names (historic, timeless, penny, duel, future, gladiator,
oldschool, tlr) do not exist here.

## Prices are filterable but never returned

`price<5` filters upstream, but the tool **never returns a price** — `D-06` makes Scryfall the
price source. To show what the pieces cost, take each combo card's name or `oracle_id` and run a
**card search**. The same is true of images: none are returned here.

## Error text → the fix

| What comes back | What it means | The revision |
|---|---|---|
| An error naming an unexpected character at a position | One operator or a delimiter is malformed | Fix that character; leave the rest of `q` alone |
| A `bad_request` refusing a `format` and listing valid names | An unknown format was passed | Pick one of the 16 listed names |
| A `bad_request` saying an `offset` is past the end | Paged beyond the last combo | Start at `offset: 0`, follow `next_offset` |
| Success, `total_combos: 0`, `combos: []`, a `note` | **Not an error.** Valid query, no matches | Loosen: drop the narrowest constraint or widen a comparison |
| Success, but `total_combos` is huge | The query is too loose | Add `cards<=N`, a `result:`, a `ci:`, or `steps<=N` — narrow, do not walk every page |

After two or three revisions that still fail, stop and tell the user what you tried and what
Commander Spellbook said. Do not loop.
