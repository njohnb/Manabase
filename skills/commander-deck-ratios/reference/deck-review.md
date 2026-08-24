# Testing a deck and adapting it to a playgroup

Read this after the slot counts are settled. Everything here assumes the deck already passes the
four checks in `SKILL.md`; these are the questions that ratios alone cannot answer.

## Goldfishing — testing opening hands

Goldfishing means playing the deck solitaire, with no opponent, to see whether it functions.

**The test.** Draw an opening hand. Play it forward and ask whether the deck can execute its
strategy by **turn 6–8**. Repeat across several hands, because one hand proves nothing in either
direction.

**The key question is narrower than "did I win":** *can the deck cast its commander on curve and
then protect it?* A commander that lands on time and immediately dies to the first removal spell
is the same problem as a commander that never lands.

**Read the result as a ratio problem.** Goldfishing does not produce card recommendations
directly — it tells you which slot is short:

| What you saw | What it usually means |
|---|---|
| Repeated two- and three-land hands | lands too low, or the curve too high for the count |
| Lands but nothing to cast | ramp over-weighted against payoff, or the curve is bottom-heavy |
| A strong start that runs dry by turn 6 | card draw is short — the most common finding |
| The commander cast late every time | ramp short, or the commander's cost is above the curve |
| Colors that will not come together | fixing, not land count — see the fixing check |

You cannot run this yourself. **Ask the user to goldfish and report what happened**, then map
their answer to the table above. Never claim to have tested a deck.

## Adapting to a playgroup

A deck is built against a metagame, not in the abstract. The same 99 can be well or badly
positioned depending on who else is at the table.

**Ask two questions.** What strategies beat this deck most often? And what is common in the
playgroup — graveyard decks, combo, heavy artifacts, wide token boards, a single dominant
commander?

**Then convert the answer into a slot, not a card list.** Hate cards come out of the removal and
synergy budgets, not out of lands or draw. Two or three targeted answers is usually the right
weight — enough to matter, few enough that they are not dead cards when that opponent is absent.

**Search for the answer by what it does**, using the operators `SKILL.md` confirms, and let the
tool return the cards. Graveyard hate, artifact removal, and board wipes are all behaviors to
search for, never cards to recall.

**Commander has no sideboard in normal play.** Advice written for 60-card formats often assumes
one. Adapting a Commander deck means changing the 99 between games, so every answer card is paid
for out of a slot that was doing something else. Say what comes out.

## Where this stops

These are judgment calls that depend on the table, the pilot, and the moment. State the trade
and let the user decide it. A recommendation that names what it costs is useful; one that
presents a preference as a rule is not.
