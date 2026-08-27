# Track A — Slice 17 results: `combo_find_deck`, and the close of [CAP-02](../MCP-PRD.md#cap-02--combo-discovery)

**Date:** 2026-08-25
**Spec:** [`TrackA-Slice17.md`](./TrackA-Slice17.md)
**Branch:** `feat/slice17-combo-find-deck`
**Delivers:** [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criteria **4, 5, 9, 10 and 13** in
full, and the remaining halves of criteria **1, 8 and 14**. With
[Slice 15](./TrackA-Slice15.md)'s 11 and 12 and [Slice 16](./TrackA-Slice16.md)'s 2, 3, 6 and 7,
**all fourteen are verified and the capability is delivered.**
**Closes no open question.**
[OQ-05](../MCP-PRD.md#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits),
[OQ-06](../MCP-PRD.md#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code)
and [OQ-14](../MCP-PRD.md#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model)
all stay open **by explicit decision**, and the capability ships with them open.

Environment: Windows 11, Node 26.7.0 locally (`.nvmrc` pins 22 for CI).

| | before | after |
|---|---|---|
| `npm test` | 56 suites / 215 tests | **70 suites / 297 tests** |
| `npm run typecheck` | clean | clean |
| `npm run acceptance` | 13/13 | **13/13**, no 429 |
| `npm run lint:docs` | OK | OK |
| `tools/list` on the rebuilt bundle | 2 tools | **3 tools** |

**One correction to carry.** The spec's acceptance criterion 20 says "the current **56 / 215**" and
`CLAUDE.md` said **56 / 210**. Measured on the unmodified tree, the baseline is **215**: the spec
is right and `CLAUDE.md` was one slice behind.

---

## 1. The live confirmation — criterion 24

**A different deck from [§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured)'s, and
its own raw figure was measured beside its shaped one.** The 94-card deck that section records was
not recoverable — the committed fixture is the *response*, and card names cannot be read back out
of it. So the run used `sample_deck.txt`, a real 100-card Azorius Commander deck, and took **two**
measurements on it rather than comparing a shaped figure for one deck against a raw figure for
another. **640,684 belongs to a different deck and is not compared against here.**

Deck: 88 distinct names for 100 cards (`13 Plains` is one line), commander **Ranar the
Ever-Watchful**, plus one deliberately invented name — 88 main names and 1 commander submitted.
Leading quantities were stripped **by the caller**, which is what the tool description instructs
and what the handler deliberately does not do (requirement 11).

| | characters | vs raw |
|---|---|---|
| Raw `POST /find-my-combos` for this deck | **1,005,265** | — |
| Shaped, `include: "matched"` (the default) | **1,073** | **0.11%** |
| Shaped, `include: "matched+near"`, page 1 | **48,660** | **4.8%** |

The raw response carried **229 variants** — 1 `included`, 126 `almostIncluded`, 102
`almostIncludedByAddingColors`, and nothing in the other three — at 4,390 characters per variant,
and crossed the network in **878 ms**. It is **1.57×** the 640,684 that section measured, which is
the point that section makes about deck payloads arriving before the spec rather than after
delivery.

Three things the run confirms beyond the counts:

- **The invented name appears in `unresolved_cards`**, and the call still returned combos. That is
  criterion 5 end to end, against both live APIs.
- **The near page is 45 of 229 combos at 48,660 characters** — under the 50,000 budget, with
  `has_more: true` and `next_offset: 45`. 1,081 characters per combo, near the cheap end of
  [§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured)'s 547–4,421 distribution.
- **`count` came back `null` and `next` came back `null`.** The first is the documented behaviour
  for a request that does not send `count=true`, and this tool never needs it — `total_combos`
  is counted after classification. The second confirms that a 229-variant result is returned
  whole when no `limit` is sent, so the upstream-paginated guard did not fire.

The default answers the question asked in **1,073 characters against 1,005,265**. Both figures are
this deck's.

## 2. A new Scryfall finding, and the tool description changed because of it

**`POST /cards/collection` rejects the combined `Front // Back` name form, and accepts either face
name alone.** **[verified 2026-08-25]** Four real cards in `sample_deck.txt` landed in
`unresolved_cards` on the live run — `Hengegate Pathway // Mistgate Pathway`,
`Legion's Landing // Adanto, the First Fort`,
`Ojer Taq, Deepest Foundation // Temple of Civilization`, and
`The Legend of Yangchen // Avatar Yangchen` — beside the one genuinely invented name.

One spaced follow-up probe isolated it. Five identifiers submitted; `data` carried four cards and
`not_found` carried one, echoed as `{"name":"Hengegate Pathway // Mistgate Pathway"}`:

| submitted | outcome |
|---|---|
| `Hengegate Pathway // Mistgate Pathway` | **not_found** |
| `Hengegate Pathway` (front face) | resolves to the full card |
| `Mistgate Pathway` (back face) | resolves to the full card |
| `Legion's Landing` | resolves |
| `The Legend of Yangchen` | resolves |

**This is not a defect in the tool and it was not worked around.** Splitting `A // B` in the
handler is decklist parsing, which the spec puts out of scope in the same breath as quantity
stripping. The names still go upstream **as submitted** (requirement 3), so nothing is lost —
Commander Spellbook may match a name Scryfall would not.

**What it does threaten is the honesty of the signal.** `unresolved_cards` naming four real cards
invites the reading "your decklist has four typos", which is a claim the response does not
establish ([§3.6](../MCP-PRD.md#36-error-surface)). So the tool description gained one clause —
*submit a double-faced card by ONE face name; the combined `Front // Back` form is reported
unresolved even though the card is real* — on exactly the precedent requirement 11 sets for
quantities: say it in the description so the model does not discover it by failure.

Worth noting the asymmetry, because it is easy to assume parity: Scryfall's **search** endpoint
accepts the combined form, and a card's own `name` field **is** the combined form. Only the batch
lookup refuses it.

## 3. The page filler is shared, and the proof is a suite nobody touched

`BYTE_BUDGET`, `ENVELOPE_RESERVE` and `fillPage` moved out of `src/tools/combo-search.ts` into
`src/spellbook/combos.ts`, beside `ComboSummary`. The shared form takes `ComboSummary[]` rather
than a wire envelope, because this tool's input is already classified across six buckets and
flattened — there is no single upstream list to hand it. `combo-search.ts` therefore maps its
window to summaries before filling instead of shaping lazily inside the loop.

**`tests/tools/combo-search.test.ts` passes unedited — 35 of 35** — including its "comboSearch —
the byte budget" suite. That is the whole evidence that the lift changed no behaviour, and it is
why the suite was not touched.

**One deviation from the spec's call signature, taken deliberately.** The shared filler is
`fillPage(summaries, extraReserve = 0)`. `ENVELOPE_RESERVE` is a flat 400 characters sized for
`combo_search`'s constant envelope; `combo_find_deck` also carries `unresolved_cards`, which scales
with its input and reaches thousands of characters on a deck full of unrecognized names. It passes
`JSON.stringify(unresolved_cards).length` as the reserve. `combo_search` calls it with one argument
and is unchanged, which is what keeps its suite green. A test asserts the two forms are identical
at `extraReserve = 0`.

## 4. Deliberate deviations from the spec, all four

| Spec says | Built | Why |
|---|---|---|
| requirement 12: the body is `{ main: [{ card }], … }` | sends `quantity: 1` | [§4.4](../MCP-PRD.md#44-commander-spellbook)'s **verified** `DeckRequest` carries `quantity`, and the PRD outranks a slice spec. Whether upstream requires the field is untested, so omitting it risked a 400 that would only surface live. Quantity carries no combo information — zero of 762 captured `uses`/`requires` entries had one other than 1 |
| requirement 9: `fillPage(flattened.slice(offset))` | `fillPage(…, extraReserve)` | §3 above |
| deliverables table omits `src/spellbook/types.ts` | modified | The `/find-my-combos` envelope belongs beside `SpellbookVariantList`, in the module whose header comment explains why the `prices` and `imageUri*` omissions are the mechanism. Declaring it in the tool would split the wire shapes across two modules and put a wire type outside that argument |
| — | tool description gained one clause | §2 above |

## 5. Where CAP-01's and `combo_search`'s rules deliberately do not apply

- **A 404 stays a failure.** No 404-to-empty mapping was ported. This source answers a valid
  request with no matches as an HTTP 200, so a 404 means a bad path.
- **`offset` indexes the CLASSIFIED list, not an upstream window.** `limit` and `offset` are never
  sent to `/find-my-combos`, so every call re-fetches the full result and re-slices locally.
  Offsets are stable because upstream classification is deterministic — the same request twice was
  byte-identical ([§4.4](../MCP-PRD.md#44-commander-spellbook)). **That is a different verified
  fact from `combo_search`'s**, which rests on `/variants/` ordering probed live 2026-08-25.
  Neither is evidence for the other.
- **`format` names the format requested**, so there is no applied-versus-requested gap of the kind
  `legalities_mode` has. `resolveFormat` is [Slice 16](./TrackA-Slice16.md)'s, reused unchanged.
- **An out-of-range offset is a `bad_request` with no `status`**, while a deck that matches nothing
  is a **successful empty result** with `total_combos: 0`. The two are asserted separately.

## 6. Ordering is a promise; fitting is not

Matched buckets flatten first, always, so **a matched combo is never displaced by a near-miss**.
An earlier draft of the spec claimed the ordering made it structurally impossible for the cap to
drop a matched combo from page 1. It does not, and the tests assert the weaker true thing: with 30
matched and 30 near combos synthesized past the budget, no near-miss appears before a matched one,
and **the matched combo pushed past the budget is the first entry at `next_offset`**.

## 7. Acceptance criteria — all fourteen of [CAP-02](../MCP-PRD.md#cap-02--combo-discovery)

| # | Criterion | Result |
|---|---|---|
| 1 | Both handlers invoked directly, no server, no transport | **met** — `combo_search` [Slice 16](./TrackA-Slice16.md), `comboFindDeck` and `resolveNames` here |
| 2 | `combo_search` sends `q` byte-identically | **met** — [Slice 16](./TrackA-Slice16.md) |
| 3 | Invalid query → structured failure, verbatim `details`, no throw | **met** — client half [Slice 15](./TrackA-Slice15.md), handler half [Slice 16](./TrackA-Slice16.md) |
| 4 | Demonic Consultation + Thassa's Oracle labelled as contained | **met** — `bucket: "included"` on combo `742-1295` from `find-my-combos-deck.json` |
| 5 | An unresolved card name is reported, not silently dropped | **met** — fixture-driven, and **live**: the invented name in `unresolved_cards` |
| 6 | No Commander Spellbook price field | **met** — compile-time via the wire types, plus a sweep over the serialized response |
| 7 | No `imageUri*` field | **met** — same, plus no `cards.scryfall.io` |
| 8 | Page filled to the byte budget; `total_combos`, `has_more`, `next_offset` reach everything once | **met in both halves** — a 45-combo walk reaches 45 distinct ids |
| 9 | `include` defaults to `"matched"`; no near-miss unless asked | **met** — asserted against all four near buckets |
| 10 | The cap is never sent upstream as `limit` | **met** — no query string on the outgoing POST even at a non-zero `offset`, and all four matched combos returned from the `limit=5` capture |
| 11 | `User-Agent` and `Accept` on every request | **met** — [Slice 15](./TrackA-Slice15.md) |
| 12 | ≤ 2 requests/second, Scryfall lanes not shared | **met** — [Slice 15](./TrackA-Slice15.md) |
| 13 | An empty or missing decklist is a structured failure with no upstream request | **met** — four shapes of empty, zero calls to **either** source |
| 14 | Legality for the format named, stated once, no other format present | **met in both halves** |

Slice acceptance criteria 1–23 and 25–27 are met. **Criterion 24 is met with the deck substitution
recorded in §1** — a different deck, with its own raw figure measured rather than borrowed.

## 8. What this slice deliberately did not do

- **No tag and no `.mcpb` release.** `claude plugin tag` writes into the same `v*` namespace
  `release.yml` watches, a released bundle cannot be withdrawn, and shipping to the Chat tab is a
  separate deliberate act. `v0.1.0` and `v0.1.1` are both spent.
- **No `plugin.json` version.** [P-08](../PLUGIN-PRD.md#p-08--version-scheme) is
  [Slice 13](./TrackC-Slice13.md)'s and still waits on [Slice 12](./TrackC-Slice12.md)'s second
  cold run. No [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft),
  [PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) or
  [PC-03](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criterion changed status.
- **No skill edit.** [Slice 9](./TrackB-Slice9.md) measured 10/10 trigger accuracy on the current
  frontmatter and editing it invalidates that rate. Whether a second query language earns a
  reference file belongs to [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md).
- **No deck URL and no `deck_read`.** `/card-list-from-url` and `/card-list-from-text` are
  untouched. This tool composes with
  [OQ-12](../MCP-PRD.md#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two)'s
  `deck_read` when it lands and acquired no dependency on it.
- **No caching, no persistence, no `cacheDir` use.** Two Scryfall requests for a 100-card deck is
  the measured cost and it is acceptable.
- **No name deduplication.** A repeated name is submitted twice, which keeps criterion 10's
  request arithmetic literal rather than conditional on the deck's contents.
- **No handler-side `A // B` splitting.** See §2 — that is decklist parsing, and the reporting path
  handles it honestly.
- **[OQ-14](../MCP-PRD.md#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model)
  was not measured.** Its resolution method is an eval run that needs the tool to exist first, so
  it is post-[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) work rather than a build task. Both
  tools now exist, so it is available for the first time.
- **No `D-` decision was minted**, and [§2](../MCP-PRD.md#2-locked-decisions) and
  [§3](../MCP-PRD.md#3-constraints) of both PRDs are untouched.
  [§4](../MCP-PRD.md#4-external-dependencies) gained one dated addendum, appended.
