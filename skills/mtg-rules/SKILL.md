---
name: mtg-rules
description: "Answer a Magic: The Gathering rules or card-interaction question — how ward works, does Rest in Peace stop my death triggers, can I respond to cascade, what mana value means — by looking up the Comprehensive Rules and the cards' official rulings, then citing them."
when_to_use: "Use whenever someone asks how a rule, keyword, mechanic, game term, or the commander rules work; how two or more specific cards interact; whether a play, combo, or deck addition actually works the way it is claimed to; or what a rule number says. Also use when a rules lookup or card rulings call came back empty, truncated, stale, or with an error."
---

# Answering rules questions

Two Manabase tools hold the rules. The **rules lookup** tool returns Comprehensive Rules (CR) text
by rule number or by keyword. The **card rulings** tool returns each named card's official rulings.
Your job is to look up, then cite: every rules claim in your answer is traceable to a rule number
or a ruling that a tool returned in this conversation.

**The tools are the only rules source.** If the tool a question needs is not among the tools
available to you, say which one is unavailable and stop. A web search, a rules site, a CR mirror,
or your own recollection of the rules is a substitution — it reads like an answer and is not one,
and the rules change several times a year.

## Which tool

| The question is about… | Call | Example |
|---|---|---|
| a keyword, mechanic, or game term | rules lookup, `query` | "how does ward work?" |
| a rule number the user named | rules lookup, `rule` | "what does 702.19 say?" |
| specific cards together | card rulings for **every** card, then rules lookup for the rule behind it | "does Rest in Peace stop Blood Artist?" |
| one card's own text, legality, price | card search (`scryfall-query-craft`) | "what does Blood Artist say?" |

Rulings attach to **one** card each — there is no ruling for a pair. An interaction is answered by
reading every involved card's rulings side by side, plus the CR rules they rest on.

## Procedure

1. **Name every card and every mechanic in the question.** A card the user implies ("my
   commander") is one you ask them to name.
2. **Cards involved → one card rulings call** with all of them, up to 10 names. For a two-faced
   card, submit one face name, never `Front // Back`.
3. **Check `unresolved_cards`.** A name there is a card you know nothing about. Ask the user to
   correct it, and answer about the resolved cards only after saying which one is missing.
4. **Look up the rules the answer rests on.** `query` the mechanic or the event (`"dies"`,
   `"replacement effect"`), then `rule` the number that matters to read its subrules whole.
5. **Answer from the returned text, citing as you go** (format below). Where you connect a ruling
   to a rule, say that the connection is your reading of the two cited sources.

## Rules lookup

- **Pass exactly one of `rule` or `query`.** Both or neither is refused.
- **`query` returns glossary definitions first, then rules containing the phrase.** Start a term
  question from the glossary entry, then follow its rule numbers. Use the CR's own wording: if a
  player's word ("graveyard hate", "blink") finds nothing, retry with the term the rule would use.
- **`rule` returns the rule and every subrule under it.** Prefer the narrowest number that answers
  the question; a whole section is long.
- **`truncated: true` is a cut, never the whole answer.** For a rule, `next_rule` names the first
  rule omitted — look it up if it matters. For a query, `total_glossary_matches` and
  `total_rule_matches` count everything; narrow the phrase rather than quoting a partial list.
- **A query with no match is an empty result, not an error** — rephrase. An unknown rule number is
  `not_found`: check the number (subrule letters skip `l` and `o`), or `query` for the topic.

## Card rulings

- Each ruling carries `source`: **`wotc` is an official Wizards ruling; `scryfall` is a Scryfall
  note.** Say which one you are quoting — they do not carry the same weight.
- Each ruling carries `published_at`. A ruling older than the CR version you cite may predate a
  rules change; when the two seem to disagree, cite both and say so rather than choosing silently.
- **`rulings: []` means the card has no rulings** — common, and an answer. Fall back to the CR; never
  read an empty list as "anything goes".

## Citing

Name the CR version once per answer, then cite each claim.

- **CR rule:** `CR 702.19b` — and once: *Comprehensive Rules effective `cr_effective_date`*, linked
  to `citation_url` (Wizards' own dated document).
- **Ruling:** the card, the date, and the source — *<card> ruling, `published_at`, official
  Wizards ruling* (or *Scryfall note*) — linked to the card's `scryfall_uri`.
- Quote the returned text for the sentence the answer turns on; paraphrase the rest.

## Freshness

Every rules lookup carries `cr_effective_date` and `cache_age_days`. **`stale: true` means the
weekly check for a newer CR failed and the cached copy was served.** The answer still stands on
that version: give it, state the effective date, and say a newer CR may exist. The first lookup of
a session may be slow — it downloads the rules once.

## When it goes wrong

- **A structured failure carries its reason.** A `bad_request` names what to fix; fix it and call
  again, two or three revisions at most, then tell the user what you tried.
- **A Wizards refusal or a changed page is reported, never worked around.** Tell the user the rules
  could not be reached and why; do not fetch the CR from anywhere else.
- **Out of scope:** tournament policy (the MTR and IPG) is not in either tool. Say so instead of
  answering it.

## From the combo and deck skills

A "does this actually work?" question about a combo or a deck addition comes here. Commander
Spellbook's own combo results are **not** re-checked by default — only when the user asks whether
one works, or the combo is one they devised themselves.
