# 01: Card rulings — CAP-03 spec and the `card_rulings` tool

**What to build:** a user asks how two or three specific cards interact, and Claude fetches every
card's rulings in one tool call. The call returns each ruling's date, its source label (official
Wizards ruling or Scryfall note) and a link to the card's Scryfall page. A misspelled name comes
back as unresolved rather than silently dropped. The CAP-03 spec lands in the same change as the
code. Details are in the [PRD](../../2026-11-15-mtg-rules-prd.md), under "Card rulings handler".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent. One step needs the author: the
[D-07](../../../MCP-PRD.md#d-07--three-way-cache-split) reading, see the first criterion.

- [ ] The author has confirmed the D-07 reading: D-07's bulk-file rule covers corpora that would
      otherwise cost thousands of requests, so a capped per-call lookup uses the live endpoint.
      That reading is recorded as a sentence in CAP-03, and D-07 itself is not edited. If the
      author reads D-07 the other way, stop: this ticket becomes stateful and must be re-planned.
- [ ] One spaced live probe of Scryfall's per-card rulings endpoint verifies the response shape.
      It is recorded as a dated, verified addendum under
      [MCP-PRD §4.1](../../../MCP-PRD.md#41-scryfall-rest-api).
- [ ] A CAP-03 block is appended to [MCP-PRD §5](../../../MCP-PRD.md#5-capabilities) under its
      template, and §6, §7 and §9 are updated. Nothing else in the PRD changes.
- [ ] `card_rulings` accepts up to the capped number of names, about 10, and rejects more with a
      structured `bad_request`.
- [ ] Names resolve through the existing batch resolver, and misses are returned in
      `unresolved_cards`. The combined `Front // Back` trap from
      [§4.1.2](../../../MCP-PRD.md#412-batch-resolution) is handled the same way
      `combo_find_deck` handles it, through a description clause telling the model to submit one
      face name.
- [ ] One rulings request is made per resolved card, on Scryfall's 10/sec lane. No 429 is
      provoked.
- [ ] Every ruling carries its `source`, its date and its comment. Every card carries its Scryfall
      page link. A card with no rulings returns an empty list, not a failure.
- [ ] The handler never throws, per [D-10](../../../MCP-PRD.md#d-10--tool-handlers-never-throw).
- [ ] Handler tests with fakes cover a mixed resolved/unresolved batch, a card with zero rulings,
      the cap, and an upstream failure.
- [ ] The tool is registered, the MCPB manifest declares it (the drift test passes), `dist/` is
      rebuilt, the typecheck is clean and `npm test` passes.
- [ ] A spaced live check is added to `npm run acceptance` and passes with no 429.
- [ ] The plugin version is bumped with `npm run bump-version` in the PR.
- [ ] `doc-sync` is dispatched as the closeout.
