# Track A — Slice 14 results: result trim and page cap

**Date:** 2026-08-10
**Spec:** [`TrackA-Slice14.md`](./TrackA-Slice14.md)
**Closes:** [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be), issue #25
**Delivers:** [CAP-01](../MCP-PRD.md#cap-01--card-search) criterion 13 (added 2026-08-04, until now
unimplemented) and a new criterion 14.

Environment: Windows 11, Node 26.5.1 locally (`.nvmrc` pins 22 for CI), `npm test` 101 tests /
27 suites, `npm run acceptance` 13/13 live.

---

## 1. The headline measurement

Issue #25's exact query — `t:legendary t:creature id=rg is:commander f:commander`, `order: edhrec`
— run **live through the built server** (`dist/index.js` over stdio JSON-RPC), which is the "confirm
the shaped page against a real harness rather than a local measurement" half of
[OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be)'s stated resolution:

| | before | after |
|---|---|---|
| characters | **116,626** (breached the ceiling) | **53,043** |
| cards returned | 111 | 88 |
| `total_cards` | 111 | 111 |
| `has_more` | `false` | **`true`** |
| `legalities` keys per card | 23 | **1** (`commander`) |

Page 2 of the same query returned the remaining **23 cards** in 12,432 characters, `has_more: false`
— so **all 111 cards are reachable**, 88 + 23, and nothing was discarded. That is criterion 14's
substance: the cap announces itself and strands nothing.

**A 54.5% reduction, not the ~66% the fixture predicted.** The 175-card fixture shapes to 39,844
characters under the same trim, i.e. ~453 characters per card, while issue #25's legendary creatures
cost ~603. Per-card cost varies with the cards a query returns — the effect
[OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) warned about when it measured
969 chars/card against issue #25's 1,050. **This is why the byte test asserts a bound and not a
number**; an exact-equality assertion would fail on a fixture refresh for no real reason.

## 2. The trim, by mode

Measured against `tests/fixtures/search-full-page.json` — one real 175-card page with all 23
legality keys, captured in a single live call — shaped through the handler with a fake client:

| mode | keys/card | chars (88-card page) |
|---|---|---|
| `all` | 23 | 80,327 |
| `default` | 7 | 49,926 |
| `queried` (`f:commander`) | 1 | 39,844 |

Against [§4.1.1](../MCP-PRD.md#411-search-endpoint)'s 169,504 for a full untrimmed 175-card page,
the shipped default is a **76% reduction** — the trim and the cap multiplying, as the decision said
they would.

## 3. The page size is 88, and the reason is reachability, not bytes

[OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) estimated "near 120". **120 is
not implementable.** Scryfall's `page` parameter is in units of **175** and the endpoint exposes no
offset, so a 120-card cap over a 175-card upstream page leaves cards 121–175 reachable by **no
`page` value at all** — a silent loss strictly worse than the payload problem the cap exists to fix.

88 is exactly half of 175, so our page *n* is:

```
upstreamPage = floor((n - 1) / 2) + 1
offset       = ((n - 1) % 2) * 88
```

Every card is reachable, at **one upstream request per call** — which also keeps the
[§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) request budget flat. Verified
by call-counting on a scripted fake client (acceptance criterion 5).

Two consequences that are easy to get wrong, and both are tested:

- **The page count is not `ceil(total_cards / 88)`.** The halves are 88 and 87, so counting anchors
  to upstream pages: `U = ceil(total/175)`, `lastLen = total - (U-1)*175`,
  `ourPages = (U-1)*2 + (lastLen > 88 ? 2 : 1)`. A 176-card result is **3** pages, where the naive
  figure says 2 and would tell the model a page does not exist when it does.
- **The card *range* in the note is not `(page-1)*88+1`.** That form drifts one card per upstream
  page and is already wrong on page 3 — it says 177 where the truth is 176. The range comes from
  `(upstreamPage-1)*175 + offset + 1`. Verified contiguous: 1–88, 89–175, 176–263, 264–350, 351–438.

## 4. Live findings — three, all recorded in [§4.1.1](../MCP-PRD.md#411-search-endpoint)

Probed with single spaced calls through the app's own client and User-Agent.

1. **`format:` and `legal:` are real format operators, synonyms for `f:`.** Against a two-card
   baseline of modern-illegal cards (`t:goblin cmc>=7`), both `legal:modern` and `format:modern`
   returned **0** — they filtered rather than being silently dropped the way an unknown term is.
   The scan matches five operators, not the three the skill's `reference/operators.md` recorded.
2. **`f:edh` is accepted by Scryfall but `edh` is not a legality key.** The alias returns
   commander-legal cards, yet appears in no card's `legalities` map. A scanner treating a scanned
   token as a key would emit an **empty** legalities map from a good query — a normal-looking 200
   carrying a wrong answer. The fallback to the seven defaults is what prevents it, and it is
   asserted for both `f:edh` and `f:notaformat`.
3. **A page past the end is HTTP 422, not 404.** It therefore misses the 404-as-empty mapping, but
   falls through the client's status table to `unexpected` — a code that reads as a server fault and
   discourages the retry that would fix it. The handler re-codes it as `bad_request`, keeping
   Scryfall's verbatim `details` and the real 422 status. `client.ts` was not touched.

**Scryfall's HTML syntax docs return 403 to an ordinary fetch.** Per
[§3.7](../MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis) this was not
worked around; the operator list was verified against the API instead, which is the sanctioned route
and gave a stronger answer anyway (behavior, not documentation).

## 5. Out-of-range pages are a failure, not an empty success

Three outcomes that could have collapsed into one indistinguishable empty response, kept apart:

| case | shape |
|---|---|
| zero matches (upstream 404) | `ok: true`, `cards: []`, **`total_cards: 0`**, Scryfall's details as `note` |
| page past the end, inside a page we hold | `ok: false`, `bad_request`, names the valid range |
| page past the last upstream page (422) | `ok: false`, `bad_request`, `status: 422`, verbatim details |

Both out-of-range flavours are failures **so the shape does not depend on the parity of the
requested page**: page 3 of a 50-card result overshoots upstream and 422s, while page 2 overshoots
inside the page already fetched. Same mistake, same reading. The message names the valid range
("50 cards match, which is 1 page of 88 (valid pages 1-1)") and says explicitly that this is not a
query that matched nothing.

`page` is also clamped — unclamped, JS `(-1) % 2 === -1` makes `page: 0` slice empty and `page: -5`
serve page 1's cards under a nonsense label. `0`, `-5`, `1.7` and `NaN` are all tested.

## 6. Acceptance criteria

| # | criterion | status |
|---|---|---|
| 1 | `legalities` enum, defaults to `queried` when absent/wrong-typed | ✅ unit |
| 2 | [CAP-01](../MCP-PRD.md#cap-01--card-search) #13 — queried / default / all key sets | ✅ unit, multi-card |
| 3 | `f:notaformat` and `f:edh` → the seven, never empty | ✅ unit |
| 4 | [CAP-01](../MCP-PRD.md#cap-01--card-search) #14 — 111 cards → 88 + `has_more`, page 2 → 23 | ✅ unit **and live** |
| 5 | 175-page splits 88/87, one upstream request each | ✅ unit, call-counted |
| 6 | `total_cards: 176` reports 3 pages | ✅ unit |
| 7 | past-the-end distinguishable from zero matches, names the range | ✅ unit, both flavours |
| 8 | both scope fields present and accurate under all three modes | ✅ unit |
| 9 | issue #25 live, recorded beside 116,626 | ✅ **53,043** |
| 10 | no stale `175` page-size assertion; harness asserts `<= 88` | ✅ swept |
| 11 | `npm test` green, `npm run typecheck` clean | ✅ 101/101, clean |
| 12 | `npm run build` leaves `dist/` clean, same commit | ✅ |
| 13 | PRD: field list, criterion 14, delivery addendum, OQ-02 closed, one §9 row | ✅ |
| 14 | `npm run lint:docs` passes | ✅ |
| 15 | this document | ✅ |

## 7. What this slice deliberately did not do

- **No `.mcpb` release and no tag *in the slice itself*.** `v0.1.0` is spent and `claude plugin tag`
  writes into the same `v*` namespace `release.yml` watches, so an accidental tag cuts a second
  bundle release — and a released bundle cannot be withdrawn. Shipping this fix to the Chat tab was
  a separate, deliberate act; see the addendum below, which is what happened.
- **No `oracle_text` trim** (17.3% of a page, and the field the model reasons from), **no EUR
  fallback** ([OQ-09](../MCP-PRD.md#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists)
  is a different unimplemented decision in the same file), no `fields` parameter, no `verbose`
  boolean, no auto-paging, no caching, no new dependencies.
- **No client-side query parsing.** The scan reads `q` and never alters what is sent
  ([D-07](../MCP-PRD.md#d-07--three-way-cache-split)).

**Two lines under `skills/` were changed**, as a narrow deliberate exception to the spec's "no
`skills/` edits", agreed with the author: `SKILL.md` said "at most 175 come back per page" and
"`order` decides *which* 175 cards you see first", both of which the cap makes false. Only the
numbers changed. The frontmatter is byte-identical, so
[Slice 9](./TrackB-Slice9.md)'s 10/10 trigger-accuracy measurement stands.

---

## Addendum — released as `v0.1.1`, 2026-08-10

The slice shipped no tag; the release was cut immediately afterwards as a separate deliberate act,
on the author's instruction. PR #41 merged to `main` (CI green on the head commit), then tag
`v0.1.1` on the merge commit ran
[`release.yml`](../../.github/workflows/ci-release.yml) and published `manabase.mcpb`, **113,631
bytes**. Verified against the *downloaded* asset rather than the local pack: manifest `version`
`0.1.1`, `display_name` `Manabase`, `PAGE_SIZE = 88` present, `legalities_included` present, no
stale "175 cards per page" string, and the released `server/index.js` **sha256-matches the committed
`dist/index.js`** — which is [PC-03](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criterion
7 holding on a second release.

**`v0.1.0` was not moved or deleted.** A released bundle cannot be withdrawn, so a defect ships as a
new version and a new tag; that is exactly what this was.

**No [PC-03](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criterion changed status.**
Criterion 8 — installing asks for no configuration — remains the only unverified one, because
`v0.1.1` has not been installed on Claude Desktop. The tag versions the **bundle**, not the plugin
([PQ-09](../PLUGIN-PRD.md#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)):
[P-08](../PLUGIN-PRD.md#p-08--version-scheme) is untouched, `plugin.json` still carries no
`version`, and [PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 9 stays open.

**One trap worth carrying.** The version first requested was `0.1.01`, which is **not valid
semver** — semver forbids a leading zero in a numeric identifier — and
[`scripts/pack-mcpb.mjs`](../../scripts/pack-mcpb.mjs)'s guard is
`^\d+\.\d+\.\d+(?:[-+].+)?$`, which **accepts it**, because `\d+` matches `01`. It would have been
stamped into a manifest that cannot be recalled. Check a candidate version against real semver
(`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$`), not against that regex. Widening the guard is a
reasonable follow-up and is **not** done here.

**And shipping the fix did not deliver it.** A bundle never self-updates, so every `v0.1.0` install
still carries the issue-#25 payload until someone reinstalls — which sharpens
[PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest)'s user-facing half rather than
easing it: there is now a released bundle that is known stale, and nothing tells its users so.
