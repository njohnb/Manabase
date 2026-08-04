# Operator catalog

Look up, don't read. Every operator below has been observed working against Scryfall. Anything
absent from this file is not approved for use — see **Not real — never emit**.

All of these go inside the `q` argument of `mcp__plugin_manabase_mtg__card_search`.

## Types

| Operator | Argument | Selects |
|---|---|---|
| `t:` | a type, subtype, or supertype word | cards whose type line contains it — `t:creature`, `t:legendary`, `t:squirrel`, `t:artifact` |

## Colors

| Operator | Argument | Selects |
|---|---|---|
| `c:` | `w` `u` `b` `r` `g` `c`, combined (`wu`), or a guild/shard/wedge name | cards of that color |
| `id:` | same argument forms as `c:` | cards whose **color identity** fits — the commander deck-legality sense |

## Mana value

| Operator | Argument | Selects |
|---|---|---|
| `cmc` | a number with a comparison — `cmc=0`, `cmc<=2`, `cmc>=7` | cards by mana value |
| `mv` | identical; `mv` is an alias of `cmc` | same field, same comparisons |

## Rules text

| Operator | Argument | Selects |
|---|---|---|
| `o:` | a word or a quoted phrase — `o:flying`, `o:"draw a card"` | cards whose oracle text contains it |
| `o:/…/` | a regular expression — `o:/^{T}: Add/` | cards whose oracle text matches the pattern; use for anchors, alternation, and character classes that plain `o:` cannot express |

## Function and tags

| Operator | Argument | Selects |
|---|---|---|
| `otag:` | a community oracle-tag name — `otag:ramp` | cards tagged with that behavior, regardless of wording |
| `function:` | a community function tag — `function:removal` | same family; reach for it when the request is about what a card *does* |
| `art:` | a subject word — `art:squirrel` | cards whose artwork depicts it |
| `atag:` | an art-tag name — `atag:squirrel` | cards carrying that community art tag |

## Printing

| Operator | Argument | Selects |
|---|---|---|
| `set:` | a set code — `set:dom` | printings from that set |
| `r:` | `common` `uncommon` `rare` `mythic`, with any comparison — `r:mythic`, `r!=common`, `r>=rare` | cards of that rarity |
| `game:` | `paper`, `arena`, `mtgo` | cards available on that game platform |
| `unique:prints` | none | the query-embedded form of the `unique` parameter; prefer the `unique` parameter itself |

## Format

| Operator | Argument | Selects |
|---|---|---|
| `f:` | a format name — `f:commander`, `f:modern`, `f:pauper`, `f:standard` | cards playable in that format |
| `banned:` | a format name — `banned:commander` | cards barred from that format |
| `restricted:` | a format name — `restricted:vintage` | cards limited to one copy in that format |

## Price

| Operator | Argument | Selects |
|---|---|---|
| `usd` | a number with a comparison — `usd<=1`, `usd>=50`, `usd<0.25` | cards by USD price |

## Combat stats and keywords

| Operator | Argument | Selects |
|---|---|---|
| `pow` | a number with a comparison — `pow>=5` | cards by power |
| `tou` | a number with a comparison — `tou<=1` | cards by toughness. Variable (`*`) toughness compares as 0 |
| `kw:` | a keyword name — `kw:deathtouch`, `kw:flying` | cards with that keyword ability |

## Name

| Operator | Argument | Selects |
|---|---|---|
| `name:` | a word or fragment | cards whose name contains it (substring) |
| `!"…"` | a full card name in quotes — `!"<CARDNAME>"` | that exact name and nothing else; the leading `!` is what makes it exact |

## Shortcuts

| Operator | Argument | Selects |
|---|---|---|
| `is:` | a property word — `is:reprint`, `is:commander`, `is:permanent` | cards with that property |
| `not:` | the same property words — `not:reprint` | the complement of `is:` |

## Structure

| Form | Meaning |
|---|---|
| *(space)* | implicit AND — every term must hold |
| `or` | boolean OR between terms, written as the word — `t:squirrel or t:beast` |
| `( … )` | grouping — `t:squirrel (c:g or c:b) cmc<=2` |
| `-` | negation, as a prefix on any term — `-t:land`, `-is:reprint` |
| `=` `!=` `<` `<=` `>` `>=` | comparisons, usable on `cmc`/`mv`, `usd`, `pow`, `tou`, `r` |

## `order` parameter values

Not query operators — values for the tool's `order` argument. `name`, `cmc`, `usd`, `edhrec`,
`released`. Pair with `dir`: `auto` | `asc` | `desc`.

## Not real — never emit

- **`illustrationtag:`** — does not exist. It patterns exactly like `otag:` and `atag:`, which is
  why it is tempting. Use `art:` or `atag:` for artwork, `otag:` or `function:` for behavior.
- **Anything not listed in this file.** An operator that feels like it must exist is the likeliest
  one to be wrong, and Scryfall does not reliably tell you: it rejects a query only when *every*
  term is invalid. A single invented term alongside valid ones is dropped silently, and the
  200-response you get back was computed from fewer constraints than you asked for.
