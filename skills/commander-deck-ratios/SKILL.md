---
name: commander-deck-ratios
description: "Budget a Commander/EDH deck across its 99 slots — lands, ramp, card draw, removal, win conditions, synergy — then recommend, cut, or replace cards against that budget, checking every card against the card search tool instead of from memory."
when_to_use: "Use when someone wants deckbuilding judgment rather than a card list: what to add, what to cut, what to swap, whether a deck runs enough lands or ramp or draw, how many win conditions it needs, or help starting a Commander deck from a commander or a theme. Also use when someone pastes a decklist and asks about it. For a plain card lookup with no deck behind it, use scryfall-query-craft instead."
---

# Budgeting a Commander deck

A Commander deck is 100 cards: **1 commander and 99 others**. This skill decides what those 99
should be made of, then fills the gaps with real cards.

**Every card fact comes from the card search tool.** Never name a card, its text, its cost, its
price, or its legality from memory or from a web page. If that tool is not available to you, say
so plainly and stop. This skill carries the ratio, never the cards.

**That covers statistics as well as cards.** Deck sites publish averages for popular commanders,
and they are a reasonable thing for the *user* to consult. You do not fetch them. Compute the
curve and the slot counts from the deck in front of you, and say the numbers are that deck's own.
A benchmark retrieved from a page you cannot verify is the same failure as naming a card from
memory — it looks like an answer and nothing checked it.

## The baseline ratio

| Slot | Count | Notes |
|---|---|---|
| Commander | 1 | outside the 99 |
| Lands | 36–38 | see the land check below |
| Ramp | 10–12 | mana acceleration and fixing |
| Card draw | 8–10 | the slot most decks shortchange |
| Removal | 8–10 | interaction, spot and sweeper |
| Win conditions | 7–10 | how the game actually ends |
| Synergy / theme | 15–20 | what makes it this deck |

**This is a default, not a law.** Say which numbers you used and why whenever you depart from
them.

## Four rules that make the baseline work

**1. A card counts in every slot it fills.** One card can be removal *and* card draw, or ramp
*and* synergy. Count it in both. Do not force each card into a single slot.

That rule is structural, not a convenience. The low ends sum to 84 and the high ends sum to 100,
against 99 slots — so the ranges only reconcile if cards double-count. A deck counted one-card-one-slot
will look short on every axis at once. If your totals come out near 84, you are undercounting
overlap, not missing 15 cards.

**2. The theme moves the numbers.** A landfall deck runs more than 38 lands on purpose. A
low-curve aggressive deck can sit at 34–35. A spellslinger deck may run fewer creatures than any
win-condition count suggests. Adjust the slot, then say you adjusted it.

**3. Power level changes card quality, not slot counts.** Budget and high-power decks both run
roughly 36–38 lands and 10–12 ramp. What changes is what fills the slot — basics and cheap
staples versus efficient duals and fast mana. Never answer a budget question by cutting the
skeleton.

**4. The user overrides everything.** If someone says they want 40 lands, build to 40 lands.

## Four checks on any deck

**Lands.** Cross-check the count against `28 + (2 × colors) + average mana value`. A three-color
deck averaging 3.5 gives 37.5 — inside the band. **The formula and the band disagree at low color
counts**: a mono-color deck averaging 3.0 gives 33, below the 36–38 band. When they disagree,
the band wins and 34–35 is the floor, reserved for a genuinely low curve with plenty of cheap
ramp. Too few lands is the most common fault in a new deck.

**Curve.** Average mana value should land around **2.5–3.5**. Above it the deck stumbles early;
below it the deck runs out of impact. Cheap interaction and cheap ramp are what pull a high curve
back down.

**Fixing.** At three or more colors, count how many lands produce more than one color and how much
of the ramp fixes rather than only accelerates. Color screw loses games that mana screw would not.
**This is not a new slot** — it is a quality constraint on the lands and ramp you already
budgeted, so raising it means swapping within those counts, never adding to them.

**Interaction density.** Removal plus card draw should be about **30% of the non-land cards**.
That is a cross-check on the ratio rather than a separate rule, and it agrees with it: 99 − 37
lands leaves 62, 30% of 62 is ~19, and the ratio's 8–10 removal plus 8–10 draw gives 16–20. If a
deck fails this check it will usually fail the draw and removal slots too — say which.

Prefer **instant-speed** interaction where the choice exists. A deck that can only act on its own
turn cannot answer a combo, and that is the loss no card quality compensates for.

## Procedure

1. **Establish the commander and the strategy.** If either is missing or vague, ask before
   searching — see below.
2. **Count the deck into slots** if one was given, applying rule 1. Report the counts you got.
3. **Name the gaps** against the baseline, largest first.
4. **Search one gap at a time** with the card search tool, constrained to the commander's color
   identity (`id:`) and `f:commander`.
5. **Recommend by slot**, saying which slot each card fills and why. For a replacement, name what
   it comes out for and what the swap changes.

## Reviewing a deck someone already has

Six faults account for most weak Commander decks. Four are the ratio read from the failure
direction, so check them by counting; two are judgment.

| Fault | How you see it | Fix |
|---|---|---|
| Not enough card draw | draw slot under 8 | the slot most decks shortchange — raise it first |
| Too few lands | 32–35 without a low curve | go to 36–38; new decks run too few |
| Ignoring interaction | removal slot under 8 | raise to 8–10, favoring instant speed |
| Curve too high | average mana value above 3.5 | add cheap interaction and cheap ramp |
| Poor color fixing | 3+ colors, mostly single-color sources | swap within the land and ramp counts |
| No clear win condition | *judgment* — see below | make every card serve a stated plan |

**The win-condition test is the one that is not arithmetic.** Ask the user to say, in one
sentence, how the deck wins. If they cannot, that is the finding — report it before recommending
cards, because a deck of individually good cards with no stated plan cannot be improved by adding
another good card. "Good cards" is not a strategy.

Report the counts you measured, not just the verdict. A number the user can check beats a
judgment they cannot.

For deck testing and adapting to a playgroup, read `reference/deck-review.md`.

## Turning a slot into a query

Constrain every search to the deck: `id:<commander identity>` and `f:commander`. Add `usd<=N` when
a budget was stated. For syntax beyond this, use the scryfall-query-craft skill.

| Slot | Starting point |
|---|---|
| Lands | `t:land id:<identity>` |
| Ramp | `otag:ramp` |
| Fixing | `otag:ramp t:artifact`, or `t:land id:<identity>` judged from returned oracle text |
| Removal | `function:removal` |
| Card draw | `o:"draw a card"` — no verified tag exists for this slot |
| Win conditions | no tag; derive from the deck's own strategy |
| Synergy | derive from the theme — tribal `t:<type>`, mechanic `o:"<keyword>"` |

There is **no confirmed operator here for how many colors a land produces.** Search `t:land` with
the color identity and read the returned text rather than reaching for an operator that sounds
like it should exist.

**Only `otag:ramp` and `function:removal` are confirmed to work here.** Community tag names that
*look* plausible — a draw tag, a wincon tag — are the single most dangerous guess you can make:
Scryfall **silently drops** an invalid term whenever at least one valid term remains, so a wrong
tag returns an ordinary-looking result computed from fewer constraints than you asked for. No
error appears.

So: **never emit a tag name you have not seen work.** For any slot without a confirmed tag, search
oracle text instead. If a tag query returns a suspiciously large or round result, assume the tag
was dropped and rewrite it as a text search.

## When the strategy is unclear

**Ask. Do not guess a theme and search on it.** One question is cheaper than a list of wrong cards.

Themes are not always mechanical. A deck may be built around art, an IP, a creature type, or a
concept rather than a keyword — cards that share a visual motif, or that fit a joke the deck is
telling. Treat these as first-class and ask what the unifying idea is.

**Say plainly where search cannot follow.** Card search reaches artwork by subject (`art:`) and by
community art tag (`atag:`), and it reaches behavior by rules text. It has **no operator for the
colors used in an illustration**, and none for tone, mood, or narrative implication. For a theme
like that, the honest offer is a candidate pool from the closest searchable proxy, judged by the
user — not a filtered answer presented as complete. Say which part of the theme you could search
and which part you could not.

## Decks the tool cannot read

**A pasted decklist works.** Card names as text, one per line, with or without quantities.

**A deck URL does not.** There is no tool here that reads a deck from Archidekt, Moxfield, or any
other site — that capability is not built. Say so directly and ask for the list as text. Never
fetch the page, and never work from what you remember or infer about a deck you cannot see.
