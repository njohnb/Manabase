# Recipes

English request → the `q` it becomes. All of these are single calls to the Manabase card search
tool; the whole request goes into `q`, never into a broad query plus your own filtering
afterwards.

## Legality + type + cost + price, combined

| Request | `q` | Other args |
|---|---|---|
| "cheap green ramp for my commander deck" | `id:g otag:ramp f:commander cmc<=2` | `order: "cmc"` |
| "budget removal under a dollar in modern" | `function:removal f:modern usd<=1` | `order: "usd"` |
| "two-mana pauper creatures that aren't reprints" | `t:creature f:pauper cmc=2 -is:reprint` | |
| "mythic lands I could actually buy for under twenty" | `t:land r:mythic usd<=20` | `order: "usd"` |
| "free green creatures" | `t:creature c:g mv=0` | |
| "big beaters for a modern deck, five power or more, under five mana" | `t:creature pow>=5 mv<=4 f:modern` | `order: "cmc"` |
| "one-mana black or green squirrels" | `t:squirrel (c:g or c:b) cmc<=1` | |

## Patterns only regex answers

| Request | `q` |
|---|---|
| "cards whose text *starts* with a tap ability that adds mana" | `o:/^{T}: Add/` |
| "creatures that make a token when they die" | `t:creature o:/dies.*create/` |
| "cards whose text ends with a plain card-draw clause" | `o:/draw a card\.$/` |

Alternation needs a group and a pipe character, written exactly as a regex would:

```
o:/(sacrifice|exile) a creature/
```

Use regex when the request contains an anchor ("starts with", "ends with"), an alternation
("either … or"), or ordering between two phrases. Use plain `o:"…"` for a literal phrase.

**`^` and `$` anchor to a line, not to the card** — oracle text is one line per ability, so the
first two rows above mean "some line starts/ends with this". When the user genuinely means the
whole text box, subtract the newline-preceded form:

| Request | `q` |
|---|---|
| "the ability has to *lead* the card, not sit halfway down" | `o:/^whenever you cast/ -o:/\nwhenever you cast/` |

It is an approximation — it also drops a card that leads with the phrase and repeats it later.
`\A`, `\z` and `(?-m:…)` are not available; see `operators.md`, and note that `\A` fails *silently*
by returning zero matches.

## What a card *does*, not what it says

| Request | `q` |
|---|---|
| "artifacts that ramp me" | `t:artifact otag:ramp` |
| "cheap instant-speed removal in white" | `function:removal t:instant c:w cmc<=2` |
| "green cards that fetch a land" | `c:g otag:ramp t:sorcery` |

`otag:` and `function:` search community-maintained tags rather than card text, so they catch
cards that accomplish the thing with wording the user never typed. Reach for them whenever the
request describes an effect rather than a phrase.

## Artwork

| Request | `q` |
|---|---|
| "cards with squirrel art" | `art:squirrel` |
| "squirrel artwork that isn't a squirrel card" | `art:squirrel -t:squirrel` |
| "every printing with that art" | `atag:squirrel` with `unique: "art"` |

`art:` and `atag:` are the artwork operators. `illustrationtag:` is not real — never emit it.

## Printing-specific questions

| Request | `q` | Other args |
|---|---|---|
| "what does <CARDNAME> cost?" | `!"<CARDNAME>" game:paper` | `unique: "prints"`, `order: "usd"` |
| "which sets is <CARDNAME> in?" | `!"<CARDNAME>"` | `unique: "prints"`, `order: "released"` |

`unique: "prints"` belongs to questions about a printing. A deckbuilding question wants the
default `unique: "cards"`.

## Failure table

Read `details` on an error result — it is Scryfall's own text, verbatim.

| What comes back | What it means | The revision |
|---|---|---|
| "All of your terms were ignored." | *Every* term was invalid — usually one invented operator in a one-term query | Rewrite using operators from `operators.md` only |
| `details` names an unrecognized expression or operator | That one term is wrong | Replace that term; leave the rest alone |
| `details` complains about a quote, paren, or slash | Unbalanced delimiter in `q` | Balance `"`, `(`/`)`, or the regex `/…/` and retry |
| `details` says a value isn't valid for the operator | Right operator, wrong argument form | Check the argument column in `operators.md` |
| Success, `total_cards: 0`, `cards: []`, a `note` | **Not an error.** The query was valid and matched nothing | Loosen: drop the narrowest constraint, widen a comparison, or relax the format |
| Success, but `total_cards` is far larger than the request implies | A term may have been **silently dropped** — Scryfall ignores an invalid term whenever at least one valid term remains, with no warning | Re-check every operator in `q` against `operators.md`; then add the missing constraint back |
| Success with `has_more: true` and a large `total_cards` | The query is too loose | Add a constraint. Do not fetch `page: 2` unless the request genuinely wants a large list |
| `code: "rate_limited"` | Too many calls too fast | Wait, then issue one call — not a retry loop |
| `price.available: false`, `reason: "digital-only"` | A digital printing won the rollup and has no paper price | Add `game:paper` and search again |
| `price.available: false`, `reason: "no-price-data"` | No price is known | Report it as missing; never substitute a number |

After two or three revisions that still fail, stop and tell the user what you tried and what
Scryfall said. Do not loop.
